import prisma from '@/lib/prisma';
import { sendSms } from './twilio';
import { format } from 'date-fns';
import { processPaymentPrompts } from './payments';
import { expireWaitlistOffers } from './waitlist';
import { processYesConfirmations, requestYesConfirmation } from './confirmation';

export async function processScheduledReminders(): Promise<{
  processed: number;
  sent: number;
  errors: number;
  paymentPrompts: number;
  waitlistExpired: number;
  yesReminded: number;
  yesExpired: number;
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

    if (!booking || !['CONFIRMED', 'PENDING'].includes(booking.status) || !booking.business.phoneNumber) {
      await prisma.scheduledReminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: now },
      });
      continue;
    }

    if (booking.status === 'PENDING' || !booking.yesConfirmedAt) {
      try {
        await requestYesConfirmation({ bookingId: booking.id, reason: 'reminder' });
        await prisma.scheduledReminder.update({
          where: { id: reminder.id },
          data: { sent: true, sentAt: now },
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send YES confirm before reminder ${booking.id}:`, error);
        errors++;
      }
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

  const [payments, waitlist, yes] = await Promise.all([
    processPaymentPrompts(now),
    expireWaitlistOffers(now),
    processYesConfirmations(now),
  ]);

  return {
    processed: reminders.length,
    sent,
    errors,
    paymentPrompts: payments.prompted,
    waitlistExpired: waitlist.expired,
    yesReminded: yes.reminded,
    yesExpired: yes.expired,
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
