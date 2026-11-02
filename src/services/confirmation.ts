import prisma from '@/lib/prisma';
import { addMinutes, format } from 'date-fns';
import { sendSms } from './twilio';
import { logAudit } from './audit';
import { createCalendarEvent } from './calendar';

export function isAffirmativeReply(body: string): boolean {
  const normalized = body.trim().toLowerCase().replace(/[!.,]/g, '');
  return ['yes', 'y', 'yeah', 'yep', 'confirm', 'confirmed', 'ok', 'okay'].includes(normalized);
}

export function shouldExpireYesHold(booking: {
  yesConfirmRequired: boolean;
  yesConfirmedAt: Date | null;
  yesConfirmExpiresAt: Date | null;
  status: string;
}, now: Date = new Date()): boolean {
  if (!booking.yesConfirmRequired) return false;
  if (booking.yesConfirmedAt) return false;
  if (booking.status !== 'PENDING') return false;
  if (!booking.yesConfirmExpiresAt) return false;
  return booking.yesConfirmExpiresAt.getTime() <= now.getTime();
}

export function yesConfirmMessage(params: {
  serviceName: string;
  startTime: Date;
  minutes: number;
}): string {
  return `Reply YES to confirm your ${params.serviceName} on ${format(params.startTime, 'EEEE, MMMM d')} at ${format(params.startTime, 'h:mm a')}. This hold expires in ${params.minutes} minutes.`;
}

export async function requestYesConfirmation(params: {
  bookingId: string;
  reason: 'create' | 'reminder';
}): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { business: { include: { phoneNumber: true } } },
  });
  if (!booking || !booking.business.phoneNumber) return;

  const minutes = booking.business.yesConfirmMinutes || 60;
  const expiresAt = addMinutes(new Date(), minutes);

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      yesConfirmRequired: true,
      yesConfirmExpiresAt: params.reason === 'create' ? expiresAt : booking.yesConfirmExpiresAt,
      yesConfirmReminderSent: params.reason === 'reminder' ? true : booking.yesConfirmReminderSent,
      reminderConfirmSent: params.reason === 'reminder' ? true : booking.reminderConfirmSent,
    },
  });

  const body =
    params.reason === 'reminder'
      ? `Reply YES to confirm you are still coming for ${booking.serviceName} on ${format(booking.startTime, 'EEEE, MMMM d')} at ${format(booking.startTime, 'h:mm a')}.`
      : yesConfirmMessage({
          serviceName: booking.serviceName,
          startTime: booking.startTime,
          minutes,
        });

  try {
    await sendSms({
      to: booking.clientPhone,
      from: booking.business.phoneNumber.phoneNumber,
      body,
    });
  } catch (error) {
    console.error('Failed to send YES confirmation:', error);
  }

  await logAudit({
    businessId: booking.businessId,
    action: params.reason === 'reminder' ? 'REMINDER_CONFIRM_SENT' : 'YES_CONFIRM_SENT',
    actor: 'ai',
    summary: params.reason === 'reminder'
      ? `Asked ${booking.clientName} to confirm before the reminder`
      : `Asked ${booking.clientName} to reply YES for ${booking.serviceName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
  });
}

export async function confirmBookingByYes(params: {
  businessId: string;
  clientPhone: string;
}): Promise<{ success: boolean; message: string; bookingId?: string }> {
  const booking = await prisma.booking.findFirst({
    where: {
      businessId: params.businessId,
      clientPhone: params.clientPhone,
      OR: [
        { status: 'PENDING', yesConfirmRequired: true, yesConfirmedAt: null },
        { reminderConfirmSent: true, reminderYesAt: null, status: 'CONFIRMED' },
      ],
    },
    orderBy: { startTime: 'asc' },
    include: { business: true },
  });

  if (!booking) {
    return { success: false, message: 'No booking waiting on YES' };
  }

  if (booking.status === 'PENDING' && shouldExpireYesHold(booking)) {
    await expireYesHold(booking.id);
    return { success: false, message: 'That hold has expired. Text us to book again.' };
  }

  if (booking.status === 'PENDING') {
    let calendarEventId = booking.calendarEventId;
    if (!calendarEventId) {
      try {
        calendarEventId = await createCalendarEvent({
          businessId: booking.businessId,
          summary: `${booking.serviceName} - ${booking.clientName}`,
          description: `Client: ${booking.clientName}\nPhone: ${booking.clientPhone}`,
          startTime: booking.startTime,
          endTime: booking.endTime,
          attendeeEmail: booking.clientEmail || undefined,
        });
      } catch (error) {
        console.error('Failed to create calendar event on YES:', error);
      }
    }

    const nextStatus = booking.depositRequired && booking.depositStatus !== 'PAID'
      ? 'AWAITING_DEPOSIT'
      : 'CONFIRMED';

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: nextStatus,
        yesConfirmedAt: new Date(),
        confirmationSent: true,
        calendarEventId,
      },
    });

    const reminderHours = booking.business.reminderHoursBefore || 24;
    const reminderTime = new Date(booking.startTime.getTime() - reminderHours * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      await prisma.scheduledReminder.create({
        data: { bookingId: booking.id, sendAt: reminderTime },
      });
    }

    await logAudit({
      businessId: booking.businessId,
      action: 'YES_CONFIRMED',
      actor: 'client',
      summary: `Confirmed ${booking.serviceName} on ${format(booking.startTime, 'EEEE, MMMM d')}`,
      clientPhone: booking.clientPhone,
      bookingId: booking.id,
    });

    return {
      success: true,
      message: `You are confirmed for ${booking.serviceName} on ${format(booking.startTime, 'EEEE, MMMM d')} at ${format(booking.startTime, 'h:mm a')}. See you then!`,
      bookingId: booking.id,
    };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      reminderYesAt: new Date(),
      reminderSent: true,
    },
  });

  await logAudit({
    businessId: booking.businessId,
    action: 'YES_CONFIRMED',
    actor: 'client',
    summary: `Confirmed they are still coming for ${booking.serviceName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
  });

  return {
    success: true,
    message: `Thanks ${booking.clientName}. We will see you for ${booking.serviceName} on ${format(booking.startTime, 'EEEE, MMMM d')} at ${format(booking.startTime, 'h:mm a')}.`,
    bookingId: booking.id,
  };
}

export async function expireYesHold(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
  });

  await prisma.scheduledReminder.deleteMany({
    where: { bookingId, sent: false },
  });

  await logAudit({
    businessId: booking.businessId,
    action: 'YES_EXPIRED',
    actor: 'system',
    summary: `YES hold expired for ${booking.serviceName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
  });
}

export async function processYesConfirmations(now: Date = new Date()): Promise<{
  reminded: number;
  expired: number;
}> {
  const pending = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      yesConfirmRequired: true,
      yesConfirmedAt: null,
    },
    include: { business: { include: { phoneNumber: true } } },
    take: 100,
  });

  let reminded = 0;
  let expired = 0;

  for (const booking of pending) {
    if (shouldExpireYesHold(booking, now)) {
      await expireYesHold(booking.id);
      expired++;
      continue;
    }

    if (
      booking.yesConfirmExpiresAt &&
      !booking.yesConfirmReminderSent &&
      booking.yesConfirmExpiresAt.getTime() - now.getTime() <= 15 * 60 * 1000
    ) {
      await requestYesConfirmation({ bookingId: booking.id, reason: 'reminder' });
      reminded++;
    }
  }

  return { reminded, expired };
}

export async function findPendingYes(businessId: string, clientPhone: string) {
  return prisma.booking.findFirst({
    where: {
      businessId,
      clientPhone,
      OR: [
        { status: 'PENDING', yesConfirmRequired: true, yesConfirmedAt: null },
        { reminderConfirmSent: true, reminderYesAt: null, status: 'CONFIRMED' },
      ],
    },
    orderBy: { startTime: 'asc' },
  });
}
