import { NextResponse } from 'next/server';
import { getCurrentBusiness, getCurrentUser } from '@/lib/auth';
import { PLAN_TIERS, PlanTierId, usageRatio } from '@/config/pricing';
import { getBusinessTier, getOrCreateUsagePeriod } from '@/services/usage';

export async function GET() {
  try {
    const [business, user] = await Promise.all([getCurrentBusiness(), getCurrentUser()]);
    if (!business || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = (user.subscription?.tier as PlanTierId | undefined) || (await getBusinessTier(business.id));
    const period = await getOrCreateUsagePeriod(business.id);
    const used = period.inboundSegments + period.outboundSegments;
    const cap = PLAN_TIERS[tier].includedSegments;

    return NextResponse.json({
      tier,
      used,
      cap,
      inboundSegments: period.inboundSegments,
      outboundSegments: period.outboundSegments,
      ratio: usageRatio(used, cap),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      plan: PLAN_TIERS[tier],
      plans: Object.values(PLAN_TIERS),
    });
  } catch (error) {
    console.error('Usage error:', error);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
