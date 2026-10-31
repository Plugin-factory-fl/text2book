import { NextRequest, NextResponse } from 'next/server';
import { handleWebhookEvent } from '@/services/stripe';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    const result = await handleWebhookEvent(payload, signature);

    if (!result.success) {
      console.error('Stripe webhook error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
