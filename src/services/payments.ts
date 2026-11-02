import prisma from '@/lib/prisma';
import { logAudit } from './audit';

export const PAYMENT_PROMPT_BODY =
  'The appointment has passed but no payment has yet been recorded. Did they pay the remainder of the service in person?';

export interface RemainderInput {
  priceUsd: number | null | undefined;
  depositStatus?: string | null;
  depositAmountCents?: number | null;
  paymentStatus?: string | null;
}

export function remainderCents(input: RemainderInput): number {
  const priceCents = Math.round((input.priceUsd || 0) * 100);
  const depositPaid =
    input.depositStatus === 'PAID' && input.depositAmountCents
      ? input.depositAmountCents
      : 0;
  return Math.max(0, priceCents - depositPaid);
}

export function shouldPromptForInPersonPayment(booking: {
  endTime: Date;
  status: string;
  paymentStatus: string;
  paymentPromptSent: boolean;
  price: number | null;
  depositStatus?: string | null;
  depositAmount?: number | null;
}, now: Date = new Date()): boolean {
  if (booking.paymentPromptSent) return false;
  if (booking.endTime > now) return false;
  if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) return false;
  if (['PAID', 'OUTSTANDING', 'WAIVED'].includes(booking.paymentStatus)) return false;
  return remainderCents({
    priceUsd: booking.price,
    depositStatus: booking.depositStatus,
    depositAmountCents: booking.depositAmount,
    paymentStatus: booking.paymentStatus,
  }) > 0;
}

export async function processPaymentPrompts(now: Date = new Date()): Promise<{
  prompted: number;
}> {
  const candidates = await prisma.booking.findMany({
    where: {
      paymentPromptSent: false,
      endTime: { lte: now },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
    },
    include: {
      business: true,
    },
    take: 100,
  });

  let prompted = 0;

  for (const booking of candidates) {
    if (
      !shouldPromptForInPersonPayment(
        {
          endTime: booking.endTime,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentPromptSent: booking.paymentPromptSent,
          price: booking.price,
          depositStatus: booking.depositStatus,
          depositAmount: booking.depositAmount,
        },
        now
      )
    ) {
      continue;
    }

    const owed = remainderCents({
      priceUsd: booking.price,
      depositStatus: booking.depositStatus,
      depositAmountCents: booking.depositAmount,
    });

    await prisma.ownerNotification.create({
      data: {
        businessId: booking.businessId,
        type: 'PAYMENT_PROMPT',
        bookingId: booking.id,
        clientPhone: booking.clientPhone,
        title: `Payment for ${booking.clientName}`,
        body: PAYMENT_PROMPT_BODY,
        actions: [
          { id: 'yes', label: 'Yes', kind: 'yes' },
          { id: 'no', label: 'No', kind: 'no' },
        ],
        status: 'PENDING',
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentPromptSent: true,
        remainderAmount: owed,
        status: booking.status === 'CONFIRMED' ? 'COMPLETED' : booking.status,
      },
    });

    prompted++;
  }

  return { prompted };
}

export async function recordInPersonPayment(params: {
  businessId: string;
  bookingId: string;
  actor?: 'owner' | 'system';
}): Promise<{ success: boolean; amountCents?: number; error?: string }> {
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, businessId: params.businessId },
  });

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  const amount = remainderCents({
    priceUsd: booking.price,
    depositStatus: booking.depositStatus,
    depositAmountCents: booking.depositAmount,
  });

  const recordedAt = new Date();

  await prisma.$transaction([
    prisma.paymentRecord.create({
      data: {
        businessId: params.businessId,
        bookingId: booking.id,
        clientPhone: booking.clientPhone,
        amount,
        method: 'IN_PERSON',
        recordedAt,
        notes: 'Recorded as paid in person',
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'PAID',
        remainderAmount: 0,
        remainderPaidAt: recordedAt,
        paymentMethod: 'IN_PERSON',
        status: booking.status === 'CONFIRMED' ? 'COMPLETED' : booking.status,
      },
    }),
  ]);

  await logAudit({
    businessId: params.businessId,
    action: 'PAYMENT_RECORDED',
    actor: params.actor || 'owner',
    summary: `Recorded $${(amount / 100).toFixed(2)} paid in person for ${booking.serviceName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
    metadata: { amount, method: 'IN_PERSON' },
  });

  return { success: true, amountCents: amount };
}

export async function markPaymentOutstanding(params: {
  businessId: string;
  bookingId: string;
  actor?: 'owner' | 'system';
}): Promise<{ success: boolean; draftFollowup?: string; error?: string }> {
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, businessId: params.businessId },
    include: { business: true },
  });

  if (!booking) {
    return { success: false, error: 'Booking not found' };
  }

  const amount = remainderCents({
    priceUsd: booking.price,
    depositStatus: booking.depositStatus,
    depositAmountCents: booking.depositAmount,
  });

  const draftFollowup = `Hi ${booking.clientName}, this is ${booking.business.name}. Hope you enjoyed your ${booking.serviceName}. We still have a balance of $${(amount / 100).toFixed(2)} on your visit. Reply here or stop by when you can. Thank you!`;

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentStatus: 'OUTSTANDING',
      remainderAmount: amount,
    },
  });

  await prisma.ownerNotification.create({
    data: {
      businessId: params.businessId,
      type: 'PAYMENT_FOLLOWUP',
      bookingId: booking.id,
      clientPhone: booking.clientPhone,
      title: `Outstanding balance for ${booking.clientName}`,
      body: `${booking.clientName} has an outstanding balance of $${(amount / 100).toFixed(2)}. I drafted a polite reminder. It is only sent if you approve.`,
      actions: [{ id: 'send_reminder', label: 'Approve and send', kind: 'send' }],
      status: 'PENDING',
      draftFollowup,
    },
  });

  await logAudit({
    businessId: params.businessId,
    action: 'PAYMENT_OUTSTANDING',
    actor: params.actor || 'owner',
    summary: `Marked $${(amount / 100).toFixed(2)} outstanding for ${booking.serviceName}`,
    clientPhone: booking.clientPhone,
    bookingId: booking.id,
    metadata: { amount },
  });

  return { success: true, draftFollowup };
}

export async function clientOutstandingCents(businessId: string, clientPhone: string): Promise<number> {
  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      clientPhone,
      paymentStatus: 'OUTSTANDING',
    },
  });
  return bookings.reduce((sum, b) => sum + (b.remainderAmount || 0), 0);
}
