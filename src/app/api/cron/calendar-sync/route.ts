import { NextRequest, NextResponse } from 'next/server';
import { syncBookingsWithCalendar } from '@/services/calendar';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const businesses = await prisma.business.findMany({
      where: {
        isActive: true,
        calendarConnection: {
          isActive: true,
        },
      },
      select: { id: true },
    });

    let totalCancelled = 0;
    let totalUpdated = 0;

    for (const business of businesses) {
      try {
        const result = await syncBookingsWithCalendar(business.id);
        totalCancelled += result.cancelled;
        totalUpdated += result.updated;
      } catch (error) {
        console.error(`Failed to sync calendar for business ${business.id}:`, error);
      }
    }

    return NextResponse.json({
      businessesProcessed: businesses.length,
      bookingsCancelled: totalCancelled,
      bookingsUpdated: totalUpdated,
    });
  } catch (error) {
    console.error('Calendar sync cron error:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendars' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
