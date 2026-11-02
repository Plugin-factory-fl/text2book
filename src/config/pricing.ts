/**
 * Text2Book subscription pricing.
 *
 * Single source of truth for tier prices, included SMS segments, and
 * the 50% gross margin cap. Stripe price IDs here are PLACEHOLDERS only.
 * Do not create live Stripe products from this file.
 *
 * Math is documented in docs/pricing.md.
 */

export type PlanTierId = 'STARTER' | 'GROWTH' | 'PRO';

export const PRICING_COSTS = {
  twilioSmsPerSegmentUsd: 0.0083,
  carrierFeePerSegmentUsd: 0.003,
  phoneNumberMonthlyUsd: 1.15,
  a2pLowVolumeCampaignMonthlyUsd: 1.5,
  stripePercent: 0.029,
  stripeFixedUsd: 0.3,
  aiCostPerInboundUsd: 0.0025,
  aiAmortizedPerSegmentUsd: 0.00125,
} as const;

export const SEGMENT_VARIABLE_COST_USD =
  PRICING_COSTS.twilioSmsPerSegmentUsd +
  PRICING_COSTS.carrierFeePerSegmentUsd +
  PRICING_COSTS.aiAmortizedPerSegmentUsd;

export const MONTHLY_FIXED_COST_USD =
  PRICING_COSTS.phoneNumberMonthlyUsd + PRICING_COSTS.a2pLowVolumeCampaignMonthlyUsd;

export const USAGE_WARN_RATIO = 0.8;
export const USAGE_CAP_RATIO = 1.0;
export const TARGET_GROSS_MARGIN = 0.5;

export interface PlanTier {
  id: PlanTierId;
  name: string;
  monthlyPriceUsd: number;
  includedSegments: number;
  stripePriceEnv: string;
  stripePricePlaceholder: string;
  nextTier: PlanTierId | null;
}

export const PLAN_TIERS: Record<PlanTierId, PlanTier> = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    monthlyPriceUsd: 19.99,
    includedSegments: 500,
    stripePriceEnv: 'STRIPE_PRICE_ID_STARTER',
    stripePricePlaceholder: 'price_text2book_starter_placeholder',
    nextTier: 'GROWTH',
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    monthlyPriceUsd: 29.99,
    includedSegments: 850,
    stripePriceEnv: 'STRIPE_PRICE_ID_GROWTH',
    stripePricePlaceholder: 'price_text2book_growth_placeholder',
    nextTier: 'PRO',
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    monthlyPriceUsd: 39.99,
    includedSegments: 1200,
    stripePriceEnv: 'STRIPE_PRICE_ID_PRO',
    stripePricePlaceholder: 'price_text2book_pro_placeholder',
    nextTier: null,
  },
};

export const PLAN_TIER_LIST: PlanTier[] = [PLAN_TIERS.STARTER, PLAN_TIERS.GROWTH, PLAN_TIERS.PRO];

export function getStripePriceId(tier: PlanTierId): string {
  const plan = PLAN_TIERS[tier];
  const fromEnv = process.env[plan.stripePriceEnv];
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  if (tier === 'STARTER' && process.env.STRIPE_PRICE_ID) {
    return process.env.STRIPE_PRICE_ID;
  }
  return plan.stripePricePlaceholder;
}

export function tierFromStripePriceId(priceId: string | null | undefined): PlanTierId {
  if (!priceId) return 'STARTER';
  for (const plan of PLAN_TIER_LIST) {
    const envId = process.env[plan.stripePriceEnv];
    if (envId && envId === priceId) return plan.id;
    if (plan.stripePricePlaceholder === priceId) return plan.id;
  }
  if (process.env.STRIPE_PRICE_ID && process.env.STRIPE_PRICE_ID === priceId) {
    return 'STARTER';
  }
  return 'STARTER';
}

export function stripeFeeUsd(priceUsd: number): number {
  return priceUsd * PRICING_COSTS.stripePercent + PRICING_COSTS.stripeFixedUsd;
}

export function variableCostUsd(segments: number): number {
  return segments * SEGMENT_VARIABLE_COST_USD;
}

export function totalCostUsd(priceUsd: number, segments: number): number {
  return stripeFeeUsd(priceUsd) + MONTHLY_FIXED_COST_USD + variableCostUsd(segments);
}

export function grossMargin(priceUsd: number, segments: number): number {
  if (priceUsd <= 0) return 0;
  return (priceUsd - totalCostUsd(priceUsd, segments)) / priceUsd;
}

export function maxSegmentsForMargin(priceUsd: number, minMargin: number = TARGET_GROSS_MARGIN): number {
  const maxCost = priceUsd * (1 - minMargin);
  const afterKnown = maxCost - stripeFeeUsd(priceUsd) - MONTHLY_FIXED_COST_USD;
  if (afterKnown <= 0) return 0;
  return Math.floor(afterKnown / SEGMENT_VARIABLE_COST_USD);
}

export function usageRatio(usedSegments: number, includedSegments: number): number {
  if (includedSegments <= 0) return 1;
  return usedSegments / includedSegments;
}

export function isAtWarning(usedSegments: number, includedSegments: number): boolean {
  return usageRatio(usedSegments, includedSegments) >= USAGE_WARN_RATIO;
}

export function isAtCap(usedSegments: number, includedSegments: number): boolean {
  return usageRatio(usedSegments, includedSegments) >= USAGE_CAP_RATIO;
}

export function shouldAllowInProgressConversation(params: {
  atCap: boolean;
  hasInProgressBooking: boolean;
  conversationState?: string;
}): boolean {
  if (!params.atCap) return true;
  if (params.hasInProgressBooking) return true;
  const inProgressStates = new Set([
    'COLLECTING_SERVICE',
    'COLLECTING_TIME',
    'COLLECTING_NAME',
    'COLLECTING_DETAILS',
    'CONFIRMING',
    'RESCHEDULE',
    'CANCEL',
  ]);
  if (params.conversationState && inProgressStates.has(params.conversationState)) {
    return true;
  }
  return false;
}

export function nextTierId(tier: PlanTierId): PlanTierId | null {
  return PLAN_TIERS[tier].nextTier;
}

export function billingPeriodBounds(now: Date = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

export function countSmsSegments(body: string): number {
  if (!body) return 1;
  const hasUnicode = /[^\u0000-\u007F]/.test(body);
  const singleLimit = hasUnicode ? 70 : 160;
  const concatLimit = hasUnicode ? 67 : 153;
  if (body.length <= singleLimit) return 1;
  return Math.ceil(body.length / concatLimit);
}

export function planPublicCopy(tier: PlanTier) {
  return {
    name: tier.name,
    priceLabel: `$${tier.monthlyPriceUsd.toFixed(2)} per month`,
    segmentsLabel: `${tier.includedSegments} text segments included`,
    features: [
      'Dedicated booking phone number',
      'AI booking assistant',
      'Google Calendar sync',
      'Automatic confirmations and reminders',
      `${tier.includedSegments} inbound plus outbound text segments`,
      'In person payment recording',
      'Waitlist and missed call text back',
    ],
  };
}
