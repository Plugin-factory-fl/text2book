import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { markPaymentOutstanding, recordInPersonPayment } from '@/services/payments';
import { sendSms } from '@/services/twilio';

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.ownerNotification.findMany({
      where: { businessId: business.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const notification = await prisma.ownerNotification.findFirst({
      where: { id: body.id, businessId: business.id },
    });
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const action = String(body.action || '');

    if (notification.type === 'PAYMENT_PROMPT' && notification.bookingId) {
      if (action === 'yes') {
        await recordInPersonPayment({
          businessId: business.id,
          bookingId: notification.bookingId,
          actor: 'owner',
        });
      } else if (action === 'no') {
        await markPaymentOutstanding({
          businessId: business.id,
          bookingId: notification.bookingId,
          actor: 'owner',
        });
      }
    }

    if (notification.type === 'PAYMENT_FOLLOWUP' && action === 'send_reminder' && notification.draftFollowup && notification.clientPhone) {
      const phone = await prisma.phoneNumber.findUnique({ where: { businessId: business.id } });
      if (phone) {
        await sendSms({
          to: notification.clientPhone,
          from: phone.phoneNumber,
          body: notification.draftFollowup,
        });
      }
    }

    await prisma.ownerNotification.update({
      where: { id: notification.id },
      data: { status: action.toUpperCase() || 'ACTED', resolvedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification action error:', error);
    return NextResponse.json({ error: 'Failed to handle notification' }, { status: 500 });
  }
}
