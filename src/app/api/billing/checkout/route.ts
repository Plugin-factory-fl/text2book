import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createCheckoutSession } from '@/services/stripe';
import { PlanTierId } from '@/config/pricing';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tier: PlanTierId = 'STARTER';
    try {
      const body = await request.json();
      if (body?.tier === 'GROWTH' || body?.tier === 'PRO' || body?.tier === 'STARTER') {
        tier = body.tier;
      }
    } catch {
      // no body
    }

    const result = await createCheckoutSession(user.id, user.email, tier);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
