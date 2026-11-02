import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { markPaymentOutstanding, recordInPersonPayment } from '@/services/payments';

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const bookingId = String(body.bookingId || '');
    const decision = String(body.decision || 'yes');

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    if (decision === 'no') {
      const result = await markPaymentOutstanding({
        businessId: business.id,
        bookingId,
        actor: 'owner',
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const result = await recordInPersonPayment({
      businessId: business.id,
      bookingId,
      actor: 'owner',
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Payment record error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
