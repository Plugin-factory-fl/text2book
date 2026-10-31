import { NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { getSmsCounts } from '@/services/notifications';

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usage = await getSmsCounts(business.id);

    return NextResponse.json(usage);
  } catch (error) {
    console.error('Get SMS usage error:', error);
    return NextResponse.json(
      { error: 'Failed to get SMS usage' },
      { status: 500 }
    );
  }
}
