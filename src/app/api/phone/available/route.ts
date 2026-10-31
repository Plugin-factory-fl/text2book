import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchAvailableNumbers } from '@/services/twilio';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const areaCode = searchParams.get('areaCode') || undefined;

    const numbers = await searchAvailableNumbers(areaCode);

    return NextResponse.json({ numbers });
  } catch (error) {
    console.error('Search phone numbers error:', error);
    return NextResponse.json(
      { error: 'Failed to search available numbers' },
      { status: 500 }
    );
  }
}
