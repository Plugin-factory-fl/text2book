import prisma from '@/lib/prisma';
import {
  PLAN_TIERS,
  PlanTierId,
  billingPeriodBounds,
  countSmsSegments,
  isAtCap,
  isAtWarning,
  nextTierId,
  shouldAllowInProgressConversation,
} from '@/config/pricing';

export { countSmsSegments };

export async function getBusinessTier(businessId: string): Promise<PlanTierId> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { user: { include: { subscription: true } } },
  });
  return (business?.user.subscription?.tier as PlanTierId | undefined) || 'STARTER';
}

export async function getOrCreateUsagePeriod(businessId: string, now: Date = new Date()) {
  const { periodStart, periodEnd } = billingPeriodBounds(now);
  const existing = await prisma.usagePeriod.findUnique({
    where: {
      businessId_periodStart: { businessId, periodStart },
    },
  });
  if (existing) return existing;
  return prisma.usagePeriod.create({
    data: {
      businessId,
      periodStart,
      periodEnd,
    },
  });
}

export async function recordSmsUsage(params: {
  businessId: string;
  inboundBody?: string;
  outboundBody?: string;
  now?: Date;
}): Promise<{
  inboundSegments: number;
  outboundSegments: number;
  used: number;
  cap: number;
  tier: PlanTierId;
  warn: boolean;
  atCap: boolean;
  justHitWarn: boolean;
  justHitCap: boolean;
}> {
  const now = params.now || new Date();
  const tier = await getBusinessTier(params.businessId);
  const cap = PLAN_TIERS[tier].includedSegments;
  const inbound = params.inboundBody ? countSmsSegments(params.inboundBody) : 0;
  const outbound = params.outboundBody ? countSmsSegments(params.outboundBody) : 0;
  const period = await getOrCreateUsagePeriod(params.businessId, now);

  const updated = await prisma.usagePeriod.update({
    where: { id: period.id },
    data: {
      inboundSegments: { increment: inbound },
      outboundSegments: { increment: outbound },
    },
  });

  const used = updated.inboundSegments + updated.outboundSegments;
  const warn = isAtWarning(used, cap);
  const atCap = isAtCap(used, cap);
  const justHitWarn = warn && !period.warnSent;
  const justHitCap = atCap && !period.capNotified;

  if (justHitWarn || justHitCap) {
    await prisma.usagePeriod.update({
      where: { id: period.id },
      data: {
        warnSent: warn || period.warnSent,
        capNotified: atCap || period.capNotified,
      },
    });
  }

  await prisma.phoneNumber.updateMany({
    where: { businessId: params.businessId },
    data: {
      monthlySmsSent: used,
      monthlySmsCap: cap,
    },
  });

  return {
    inboundSegments: inbound,
    outboundSegments: outbound,
    used,
    cap,
    tier,
    warn,
    atCap,
    justHitWarn,
    justHitCap,
  };
}

export async function notifyUsageThreshold(params: {
  businessId: string;
  used: number;
  cap: number;
  tier: PlanTierId;
  kind: 'warning' | 'reached';
}): Promise<void> {
  const next = nextTierId(params.tier);
  const percent = Math.round((params.used / params.cap) * 100);
  const body = next
    ? params.kind === 'warning'
      ? `You have used ${percent}% of this month's ${PLAN_TIERS[params.tier].name} texts (${params.used} of ${params.cap} segments). One click upgrade to ${PLAN_TIERS[next].name} keeps conversations flowing.`
      : `You have used this month's ${PLAN_TIERS[params.tier].name} text allowance (${params.used} of ${params.cap} segments). Upgrade to ${PLAN_TIERS[next].name} to stay at 50% margin. In progress bookings are not cut off.`
    : params.kind === 'warning'
      ? `You have used ${percent}% of this month's Pro texts (${params.used} of ${params.cap} segments). Contact us if you need overage so client conversations stay open.`
      : `You are at this month's Pro text allowance (${params.used} of ${params.cap} segments). Contact us for overage. We will not drop an in progress booking.`;

  await prisma.ownerNotification.create({
    data: {
      businessId: params.businessId,
      type: params.kind === 'warning' ? 'USAGE_WARNING' : 'USAGE_CAP',
      title: params.kind === 'warning' ? 'Text usage warning' : 'Text allowance reached',
      body,
      actions: next
        ? [{ id: 'upgrade', label: `Upgrade to ${PLAN_TIERS[next].name}`, kind: 'upgrade', tier: next }]
        : [{ id: 'contact', label: 'Contact for overage', kind: 'contact' }],
      status: 'PENDING',
    },
  });

  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    include: { user: true },
  });
  if (business?.user.email) {
    console.log(
      `[email] usage ${params.kind} to ${business.user.email}: ${body}`
    );
  }
}

export async function evaluateInboundPolicy(params: {
  businessId: string;
  clientPhone: string;
  conversationState?: string | null;
}): Promise<{ allow: boolean; atCap: boolean; tier: PlanTierId; used: number; cap: number }> {
  const tier = await getBusinessTier(params.businessId);
  const cap = PLAN_TIERS[tier].includedSegments;
  const period = await getOrCreateUsagePeriod(params.businessId);
  const used = period.inboundSegments + period.outboundSegments;
  const atCap = isAtCap(used, cap);

  const openBooking = await prisma.booking.findFirst({
    where: {
      businessId: params.businessId,
      clientPhone: params.clientPhone,
      status: { in: ['PENDING', 'AWAITING_DEPOSIT', 'CONFIRMED'] },
    },
  });

  const allow = shouldAllowInProgressConversation({
    atCap,
    hasInProgressBooking: Boolean(openBooking),
    conversationState: params.conversationState || undefined,
  });

  return { allow, atCap, tier, used, cap };
}
