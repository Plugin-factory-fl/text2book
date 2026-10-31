import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const upcoming = searchParams.get('upcoming');

    type BookingStatusType = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
    
    const where: {
      businessId: string;
      status?: { in: BookingStatusType[] };
      startTime?: { gte?: Date; lte?: Date };
    } = {
      businessId: business.id,
    };

    if (status) {
      where.status = { in: status.split(',') as BookingStatusType[] };
    }

    if (upcoming === 'true') {
      where.startTime = { gte: new Date() };
      where.status = { in: ['CONFIRMED', 'PENDING'] };
    } else {
      if (startDate) {
        where.startTime = { ...where.startTime, gte: startOfDay(new Date(startDate)) };
      }
      if (endDate) {
        where.startTime = { ...where.startTime, lte: endOfDay(new Date(endDate)) };
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: upcoming === 'true' ? 'asc' : 'desc' },
      take: 100,
      include: {
        service: { select: { name: true } },
        conversation: { select: { id: true } },
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
