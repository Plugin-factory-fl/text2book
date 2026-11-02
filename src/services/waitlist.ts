import prisma from '@/lib/prisma';
import { addMinutes, format } from 'date-fns';
import { createBooking } from './booking';
import { sendSms } from './twilio';
import { logAudit } from './audit';

export function tryClaimWaitlistOffer(params: {
  status: string;
  offerExpiresAt: Date | null;
  now?: Date;
}): 'claimed' | 'expired' | 'taken' {
  const now = params.now || new Date();
  if (params.status !== 'OFFERED') return 'taken';
  if (!params.offerExpiresAt || params.offerExpiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }
  return 'claimed';
}

export function matchesWaitlistWindow(params: {
  preferredDate?: Date | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  slotStart: Date;
}): boolean {
  const { preferredDate, windowStart, windowEnd, slotStart } = params;
  if (preferredDate) {
    const sameDay =
      preferredDate.getFullYear() === slotStart.getFullYear() &&
      preferredDate.getMonth() === slotStart.getMonth() &&
      preferredDate.getDate() === slotStart.getDate();
    if (!sameDay) return false;
  }
  if (windowStart) {
    const [h, m] = windowStart.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const slotMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
    if (slotMinutes < startMinutes) return false;
  }
  if (windowEnd) {
    const [h, m] = windowEnd.split(':').map(Number);
    const endMinutes = h * 60 + m;
    const slotMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
    if (slotMinutes > endMinutes) return false;
  }
  return true;
}

export async function joinWaitlist(params: {
  businessId: string;
  clientPhone: string;
  clientName?: string;
  serviceId?: string;
  serviceName?: string;
  preferredDate?: Date;
  windowStart?: string;
  windowEnd?: string;
}): Promise<{ id: string; position: number }> {
  const last = await prisma.waitlistEntry.findFirst({
    where: { businessId: params.businessId, status: 'WAITING' },
    orderBy: { position: 'desc' },
  });
  const position = (last?.position || 0) + 1;

  const entry = await prisma.waitlistEntry.create({
    data: {
      businessId: params.businessId,
      clientPhone: params.clientPhone,
      clientName: params.clientName,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
      preferredDate: params.preferredDate,
      windowStart: params.windowStart,
      windowEnd: params.windowEnd,
      status: 'WAITING',
      position,
    },
  });

  await logAudit({
    businessId: params.businessId,
    action: 'WAITLIST_JOINED',
    actor: 'client',
    summary: `Joined the waitlist${params.serviceName ? ` for ${params.serviceName}` : ''}`,
    clientPhone: params.clientPhone,
    metadata: { entryId: entry.id, position },
  });

  return { id: entry.id, position };
}

export async function offerCancelledSlotToWaitlist(params: {
  businessId: string;
  cancelledBookingId: string;
  startTime: Date;
  endTime: Date;
  serviceId?: string | null;
  serviceName: string;
}): Promise<{ offered: number }> {
  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    include: { phoneNumber: true },
  });
  if (!business?.phoneNumber) return { offered: 0 };

  const waiting = await prisma.waitlistEntry.findMany({
    where: {
      businessId: params.businessId,
      status: 'WAITING',
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  const matches = waiting.filter((entry) => {
    if (entry.serviceId && params.serviceId && entry.serviceId !== params.serviceId) {
      return false;
    }
    return matchesWaitlistWindow({
      preferredDate: entry.preferredDate,
      windowStart: entry.windowStart,
      windowEnd: entry.windowEnd,
      slotStart: params.startTime,
    });
  });

  const offerMinutes = business.waitlistOfferMinutes || 15;
  const expiresAt = addMinutes(new Date(), offerMinutes);
  let offered = 0;

  for (const entry of matches) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: 'OFFERED',
        offeredStartTime: params.startTime,
        offeredEndTime: params.endTime,
        offerExpiresAt: expiresAt,
        offeredBookingId: params.cancelledBookingId,
      },
    });

    const when = `${format(params.startTime, 'EEEE, MMMM d')} at ${format(params.startTime, 'h:mm a')}`;
    const body = `A ${params.serviceName} opening just came up on ${when}. Reply YES within ${offerMinutes} minutes to take it.`;

    try {
      await sendSms({
        to: entry.clientPhone,
        from: business.phoneNumber.phoneNumber,
        body,
      });
    } catch (error) {
      console.error('Failed to send waitlist offer:', error);
    }

    await logAudit({
      businessId: params.businessId,
      action: 'WAITLIST_OFFERED',
      actor: 'system',
      summary: `Offered ${params.serviceName} on ${when}`,
      clientPhone: entry.clientPhone,
      metadata: { entryId: entry.id, expiresAt: expiresAt.toISOString() },
    });

    offered++;
  }

  return { offered };
}

export async function claimWaitlistOffer(params: {
  businessId: string;
  clientPhone: string;
}): Promise<{ success: boolean; message: string; bookingId?: string }> {
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.waitlistEntry.findFirst({
      where: {
        businessId: params.businessId,
        clientPhone: params.clientPhone,
        status: 'OFFERED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!entry || !entry.offeredStartTime || !entry.offerExpiresAt) {
      return { success: false as const, message: 'No open waitlist offer' };
    }

    const claim = tryClaimWaitlistOffer({
      status: entry.status,
      offerExpiresAt: entry.offerExpiresAt,
    });

    if (claim === 'expired') {
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'EXPIRED' },
      });
      return { success: false as const, message: 'That offer has expired' };
    }

    if (claim === 'taken') {
      return { success: false as const, message: 'That slot was just taken' };
    }

    const claimed = await tx.waitlistEntry.updateMany({
      where: { id: entry.id, status: 'OFFERED' },
      data: { status: 'ACCEPTED' },
    });

    if (claimed.count !== 1) {
      return { success: false as const, message: 'That slot was just taken' };
    }

    await tx.waitlistEntry.updateMany({
      where: {
        businessId: params.businessId,
        status: 'OFFERED',
        offeredStartTime: entry.offeredStartTime,
        id: { not: entry.id },
      },
      data: { status: 'EXPIRED' },
    });

    return { success: true as const, entry };
  });

  if (!result.success || !('entry' in result) || !result.entry.offeredStartTime) {
    return { success: false, message: result.success ? 'Offer unavailable' : result.message };
  }

  const entry = result.entry;
  let serviceId = entry.serviceId;
  if (!serviceId) {
    const service = await prisma.service.findFirst({
      where: {
        businessId: params.businessId,
        isActive: true,
        ...(entry.serviceName ? { name: entry.serviceName } : {}),
      },
    });
    serviceId = service?.id || null;
  }

  if (!serviceId) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'WAITING' },
    });
    return { success: false, message: 'Could not match a service for that slot' };
  }

  const booking = await createBooking({
    businessId: params.businessId,
    serviceId,
    clientName: entry.clientName || 'Waitlist client',
    clientPhone: params.clientPhone,
    startTime: entry.offeredStartTime,
    createdByAi: true,
    requireYesConfirm: false,
  });

  if (!booking.success || !booking.booking) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'WAITING' },
    });
    return { success: false, message: booking.error || 'That slot was just taken' };
  }

  await logAudit({
    businessId: params.businessId,
    action: 'WAITLIST_ACCEPTED',
    actor: 'client',
    summary: `Took the waitlist opening for ${booking.booking.serviceName}`,
    clientPhone: params.clientPhone,
    bookingId: booking.booking.id,
  });

  return {
    success: true,
    message: `You are booked for ${booking.booking.serviceName} on ${format(booking.booking.startTime, 'EEEE, MMMM d')} at ${format(booking.booking.startTime, 'h:mm a')}.`,
    bookingId: booking.booking.id,
  };
}

export async function expireWaitlistOffers(now: Date = new Date()): Promise<{ expired: number }> {
  const stale = await prisma.waitlistEntry.updateMany({
    where: {
      status: 'OFFERED',
      offerExpiresAt: { lte: now },
    },
    data: { status: 'EXPIRED' },
  });

  if (stale.count > 0) {
    const expired = await prisma.waitlistEntry.findMany({
      where: { status: 'EXPIRED', offerExpiresAt: { lte: now } },
      take: stale.count,
    });
    for (const entry of expired) {
      await logAudit({
        businessId: entry.businessId,
        action: 'WAITLIST_EXPIRED',
        actor: 'system',
        summary: 'Waitlist offer expired',
        clientPhone: entry.clientPhone,
        metadata: { entryId: entry.id },
      });
    }
  }

  return { expired: stale.count };
}

export async function listWaitlist(businessId: string) {
  return prisma.waitlistEntry.findMany({
    where: { businessId, status: { in: ['WAITING', 'OFFERED'] } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function findActiveWaitlistOffer(businessId: string, clientPhone: string) {
  return prisma.waitlistEntry.findFirst({
    where: {
      businessId,
      clientPhone,
      status: 'OFFERED',
      offerExpiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}
