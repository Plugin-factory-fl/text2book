import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/services/calendar';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.business) {
      return NextResponse.json(
        { error: 'Business not found. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    const state = Buffer.from(
      JSON.stringify({ businessId: user.business.id })
    ).toString('base64');

    const authUrl = getAuthUrl(state);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Calendar connect error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
