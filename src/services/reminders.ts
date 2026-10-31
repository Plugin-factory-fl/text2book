import prisma from '@/lib/prisma';
import { sendSms } from './twilio';
import { format } from 'date-fns';

export async function processScheduledReminders(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const now = new Date();
  
  const reminders = await prisma.scheduledReminder.findMany({
    where: {
      sent: false,
      sendAt: { lte: now },
    },
    take: 100,
  });

  let sent = 0;
  let errors = 0;

  for (const reminder of reminders) {
    const booking = await prisma.booking.findUnique({
      where: { id: reminder.bookingId },
      include: {
        business: {
          include: { phoneNumber: true },
        },
      },
    });

    if (!booking || booking.status !== 'CONFIRMED' || !booking.business.phoneNumber) {
      await prisma.scheduledReminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: now },
      });
      continue;
    }

    try {
      const reminderMessage = `Reminder: Your ${booking.serviceName} appointment is tomorrow at ${format(booking.startTime, 'h:mm a')}. ${booking.business.name} is looking forward to seeing you!`;

      await sendSms({
        to: booking.clientPhone,
        from: booking.business.phoneNumber.phoneNumber,
        body: reminderMessage,
      });

      await prisma.scheduledReminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: now },
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSent: true },
      });

      sent++;
    } catch (error) {
      console.error(`Failed to send reminder for booking ${booking.id}:`, error);
      errors++;
    }
  }

  return {
    processed: reminders.length,
    sent,
    errors,
  };
}

export async function scheduleReminder(
  bookingId: string,
  sendAt: Date
): Promise<void> {
  await prisma.scheduledReminder.upsert({
    where: {
      id: bookingId,
    },
    create: {
      bookingId,
      sendAt,
    },
    update: {
      sendAt,
      sent: false,
      sentAt: null,
    },
  });
}
