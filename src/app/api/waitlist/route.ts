import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { joinWaitlist, listWaitlist } from '@/services/waitlist';

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const entries = await listWaitlist(business.id);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('List waitlist error:', error);
    return NextResponse.json({ error: 'Failed to load waitlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    if (!body.clientPhone) {
      return NextResponse.json({ error: 'clientPhone is required' }, { status: 400 });
    }
    const entry = await joinWaitlist({
      businessId: business.id,
      clientPhone: body.clientPhone,
      clientName: body.clientName,
      serviceId: body.serviceId,
      serviceName: body.serviceName,
      preferredDate: body.preferredDate ? new Date(body.preferredDate) : undefined,
      windowStart: body.windowStart,
      windowEnd: body.windowEnd,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Add waitlist error:', error);
    return NextResponse.json({ error: 'Failed to add waitlist entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await prisma.waitlistEntry.updateMany({
      where: { id, businessId: business.id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove waitlist error:', error);
    return NextResponse.json({ error: 'Failed to remove waitlist entry' }, { status: 500 });
  }
}
