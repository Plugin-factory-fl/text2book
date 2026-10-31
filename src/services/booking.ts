import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isSlotAvailable, createCalendarEvent } from './calendar';
import { sendSms } from './twilio';
import { format } from 'date-fns';

export interface CreateBookingParams {
  businessId: string;
  serviceId: string;
  conversationId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startTime: Date;
  notes?: string;
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
        status: { in: ['CONFIRMED', 'PENDING'] },
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
      status: { in: ['CONFIRMED', 'PENDING'] },
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

  let calendarEventId: string | null = null;
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
      status: 'CONFIRMED',
    },
  });

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

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `Cancelled: ${reason}` : booking.notes,
    },
  });

  await prisma.scheduledReminder.deleteMany({
    where: { bookingId, sent: false },
  });

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
