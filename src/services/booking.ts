import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isSlotAvailable, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendar';
import { sendSms } from './twilio';
import { format } from 'date-fns';
import { 
  isClientTrusted, 
  getDepositAmountForService, 
  createDepositCheckoutSession 
} from './stripe-connect';

export interface CreateBookingParams {
  businessId: string;
  serviceId: string;
  conversationId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startTime: Date;
  notes?: string;
  createdByAi?: boolean;
  requireYesConfirm?: boolean;
}

export interface BookingResult {
  success: boolean;
  booking?: {
    id: string;
    serviceName: string;
    startTime: Date;
    endTime: Date;
  };
  error?: string;
  depositRequired?: boolean;
  depositAmount?: number;
  depositUrl?: string;
}

export async function createBooking(params: CreateBookingParams): Promise<BookingResult> {
  const {
    businessId,
    serviceId,
    conversationId,
    clientName,
    clientPhone,
    clientEmail,
    startTime,
    notes,
    createdByAi = false,
    requireYesConfirm,
  } = params;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    return { success: false, error: 'Service not found' };
  }

  const endTime = addMinutes(startTime, service.duration);

  const available = await isSlotAvailable(businessId, startTime, endTime);
  if (!available) {
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        businessId,
        status: { in: ['CONFIRMED', 'PENDING', 'AWAITING_DEPOSIT'] },
        OR: [
          {
            startTime: { lte: startTime },
            endTime: { gt: startTime },
          },
          {
            startTime: { lt: endTime },
            endTime: { gte: endTime },
          },
          {
            startTime: { gte: startTime },
            endTime: { lte: endTime },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return {
        success: false,
        error: 'This time slot is no longer available. Please choose another time.',
      };
    }
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      businessId,
      status: { in: ['CONFIRMED', 'PENDING', 'AWAITING_DEPOSIT'] },
      OR: [
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime },
        },
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
      ],
    },
  });

  if (existingBooking) {
    return {
      success: false,
      error: 'This time slot conflicts with an existing booking.',
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { phoneNumber: true },
  });

  if (!business) {
    return { success: false, error: 'Business not found' };
  }

  const trusted = await isClientTrusted(businessId, clientPhone);
  const depositAmount = trusted ? null : await getDepositAmountForService(businessId, serviceId);
  const requiresDeposit = depositAmount !== null && depositAmount > 0;

  const holdForYes = requireYesConfirm ?? createdByAi;
  const remainderAmount = Math.max(
    0,
    Math.round((service.price || 0) * 100) - (requiresDeposit && depositAmount ? depositAmount : 0)
  );

  let calendarEventId: string | null = null;
  
  if (!requiresDeposit && !holdForYes) {
    try {
      calendarEventId = await createCalendarEvent({
        businessId,
        summary: `${service.name} - ${clientName}`,
        description: `Client: ${clientName}\nPhone: ${clientPhone}${clientEmail ? `\nEmail: ${clientEmail}` : ''}${notes ? `\nNotes: ${notes}` : ''}`,
        startTime,
        endTime,
        attendeeEmail: clientEmail,
      });
    } catch (error) {
      console.error('Failed to create calendar event:', error);
    }
  }

  const depositHoldMinutes = business.depositHoldMinutes || 30;
  const depositExpiresAt = requiresDeposit 
    ? new Date(Date.now() + depositHoldMinutes * 60 * 1000) 
    : null;
  const yesMinutes = business.yesConfirmMinutes || 60;
  const yesConfirmExpiresAt = holdForYes
    ? new Date(Date.now() + yesMinutes * 60 * 1000)
    : null;

  const initialStatus = holdForYes
    ? 'PENDING'
    : requiresDeposit
      ? 'AWAITING_DEPOSIT'
      : 'CONFIRMED';

  const booking = await prisma.booking.create({
    data: {
      businessId,
      serviceId,
      conversationId,
      clientName,
      clientPhone,
      clientEmail,
      serviceName: service.name,
      duration: service.duration,
      price: service.price,
      startTime,
      endTime,
      calendarEventId,
      status: initialStatus,
      depositRequired: requiresDeposit,
      depositAmount: depositAmount,
      depositStatus: requiresDeposit ? 'PENDING' : 'NOT_REQUIRED',
      depositExpiresAt,
      paymentStatus: 'UNPAID',
      remainderAmount,
      createdByAi,
      yesConfirmRequired: holdForYes,
      yesConfirmExpiresAt,
    },
  });

  if (requiresDeposit && depositAmount) {
    const checkoutResult = await createDepositCheckoutSession({
      bookingId: booking.id,
      businessId,
      amount: depositAmount,
      clientPhone,
      serviceName: service.name,
      businessName: business.name,
    });

    if ('error' in checkoutResult) {
      await prisma.booking.delete({ where: { id: booking.id } });
      return { success: false, error: checkoutResult.error };
    }

    return {
      success: true,
      booking: {
        id: booking.id,
        serviceName: service.name,
        startTime,
        endTime,
      },
      depositRequired: true,
      depositAmount,
      depositUrl: checkoutResult.url,
    };
  }

  const { logAudit } = await import('./audit');
  await logAudit({
    businessId,
    action: 'BOOKING_CREATED',
    actor: createdByAi ? 'ai' : 'owner',
    summary: holdForYes
      ? `Held ${service.name} pending YES from ${clientName}`
      : `Booked ${service.name} for ${clientName}`,
    clientPhone,
    bookingId: booking.id,
  });

  if (holdForYes) {
    const { requestYesConfirmation } = await import('./confirmation');
    await requestYesConfirmation({ bookingId: booking.id, reason: 'create' });
    return {
      success: true,
      booking: {
        id: booking.id,
        serviceName: service.name,
        startTime,
        endTime,
      },
    };
  }

  const reminderHours = business.reminderHoursBefore || 24;
  const reminderTime = new Date(startTime.getTime() - reminderHours * 60 * 60 * 1000);

  if (reminderTime > new Date()) {
    await prisma.scheduledReminder.create({
      data: {
        bookingId: booking.id,
        sendAt: reminderTime,
      },
    });
  }

  if (business.phoneNumber) {
    try {
      const confirmationMessage = `Your ${service.name} appointment is confirmed for ${format(startTime, 'EEEE, MMMM d')} at ${format(startTime, 'h:mm a')}. See you then!`;
      
      await sendSms({
        to: clientPhone,
        from: business.phoneNumber.phoneNumber,
        body: confirmationMessage,
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { confirmationSent: true },
      });
    } catch (error) {
      console.error('Failed to send confirmation SMS:', error);
    }
  }

  return {
    success: true,
    booking: {
      id: booking.id,
      serviceName: service.name,
      startTime,
      endTime,
    },
  };
}

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { business: { include: { phoneNumber: true } } },
  });

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status === 'CANCELLED') {
    return { success: false, error: 'Booking is already cancelled' };
  }

  if (booking.calendarEventId) {
    try {
      await deleteCalendarEvent(booking.businessId, booking.calendarEventId);
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
    }
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `Cancelled: ${reason}` : booking.notes,
      calendarEventId: null,
    },
  });

  await prisma.scheduledReminder.deleteMany({
    where: { bookingId, sent: false },
  });

  const { logAudit } = await import('./audit');
  await logAudit({
    businessId: booking.businessId,
    action: 'BOOKING_CANCELLED',
    actor: 'system',
    summary: `Cancelled ${booking.serviceName} for ${booking.clientName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
    metadata: reason ? { reason } : undefined,
  });

  try {
    const { offerCancelledSlotToWaitlist } = await import('./waitlist');
    await offerCancelledSlotToWaitlist({
      businessId: booking.businessId,
      cancelledBookingId: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
    });
  } catch (error) {
    console.error('Failed to offer cancelled slot to waitlist:', error);
  }

  if (booking.business.phoneNumber) {
    try {
      const cancelMessage = `Your ${booking.serviceName} appointment on ${format(booking.startTime, 'MMMM d')} at ${format(booking.startTime, 'h:mm a')} has been cancelled. Feel free to reach out if you would like to reschedule.`;
      
      await sendSms({
        to: booking.clientPhone,
        from: booking.business.phoneNumber.phoneNumber,
        body: cancelMessage,
      });
    } catch (error) {
      console.error('Failed to send cancellation SMS:', error);
    }
  }

  return { success: true };
}

export async function rescheduleBooking(
  bookingId: string,
  newStartTime: Date
): Promise<BookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, business: { include: { phoneNumber: true } } },
  });

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status === 'CANCELLED') {
    return { success: false, error: 'Cannot reschedule a cancelled booking' };
  }

  const duration = booking.duration;
  const newEndTime = addMinutes(newStartTime, duration);

  const available = await isSlotAvailable(booking.businessId, newStartTime, newEndTime);
  if (!available) {
    return { success: false, error: 'The new time slot is not available' };
  }

  const conflicting = await prisma.booking.findFirst({
    where: {
      businessId: booking.businessId,
      id: { not: bookingId },
      status: { in: ['CONFIRMED', 'PENDING'] },
      OR: [
        {
          startTime: { lte: newStartTime },
          endTime: { gt: newStartTime },
        },
        {
          startTime: { lt: newEndTime },
          endTime: { gte: newEndTime },
        },
      ],
    },
  });

  if (conflicting) {
    return { success: false, error: 'This time conflicts with another booking' };
  }

  const oldStartTime = booking.startTime;

  if (booking.calendarEventId) {
    try {
      await updateCalendarEvent(booking.businessId, booking.calendarEventId, {
        startTime: newStartTime,
        endTime: newEndTime,
      });
    } catch (error) {
      console.error('Failed to update calendar event:', error);
    }
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      startTime: newStartTime,
      endTime: newEndTime,
    },
  });

  await prisma.scheduledReminder.deleteMany({
    where: { bookingId, sent: false },
  });

  const reminderHours = booking.business.reminderHoursBefore || 24;
  const reminderTime = new Date(newStartTime.getTime() - reminderHours * 60 * 60 * 1000);

  if (reminderTime > new Date()) {
    await prisma.scheduledReminder.create({
      data: {
        bookingId,
        sendAt: reminderTime,
      },
    });
  }

  if (booking.business.phoneNumber) {
    try {
      const rescheduleMessage = `Your ${booking.serviceName} appointment has been rescheduled from ${format(oldStartTime, 'MMMM d')} to ${format(newStartTime, 'EEEE, MMMM d')} at ${format(newStartTime, 'h:mm a')}. See you then!`;
      
      await sendSms({
        to: booking.clientPhone,
        from: booking.business.phoneNumber.phoneNumber,
        body: rescheduleMessage,
      });
    } catch (error) {
      console.error('Failed to send reschedule SMS:', error);
    }
  }

  return {
    success: true,
    booking: {
      id: booking.id,
      serviceName: booking.serviceName,
      startTime: newStartTime,
      endTime: newEndTime,
    },
  };
}

export async function findUpcomingBookingByClientPhone(
  businessId: string,
  clientPhone: string
): Promise<{
  id: string;
  serviceName: string;
  startTime: Date;
  endTime: Date;
  calendarEventId: string | null;
} | null> {
  const booking = await prisma.booking.findFirst({
    where: {
      businessId,
      clientPhone,
      status: { in: ['CONFIRMED', 'PENDING', 'AWAITING_DEPOSIT'] },
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: 'asc' },
  });

  if (!booking) return null;

  return {
    id: booking.id,
    serviceName: booking.serviceName,
    startTime: booking.startTime,
    endTime: booking.endTime,
    calendarEventId: booking.calendarEventId,
  };
}

export async function cancelBookingByClientPhone(
  businessId: string,
  clientPhone: string,
  reason?: string
): Promise<{ success: boolean; error?: string; booking?: { serviceName: string; startTime: Date } }> {
  const booking = await findUpcomingBookingByClientPhone(businessId, clientPhone);
  
  if (!booking) {
    return { success: false, error: 'No upcoming booking found for this phone number' };
  }

  const result = await cancelBooking(booking.id, reason);
  
  if (result.success) {
    return {
      success: true,
      booking: {
        serviceName: booking.serviceName,
        startTime: booking.startTime,
      },
    };
  }

  return result;
}

export async function rescheduleBookingByClientPhone(
  businessId: string,
  clientPhone: string,
  newStartTime: Date
): Promise<BookingResult> {
  const booking = await findUpcomingBookingByClientPhone(businessId, clientPhone);
  
  if (!booking) {
    return { success: false, error: 'No upcoming booking found for this phone number' };
  }

  return rescheduleBooking(booking.id, newStartTime);
}
