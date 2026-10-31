import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendSms } from '@/services/twilio';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'AWAITING_DEPOSIT',
        depositExpiresAt: { lte: new Date() },
      },
      include: {
        business: {
          include: { phoneNumber: true },
        },
      },
    });

    let expiredCount = 0;
    let notifiedCount = 0;

    for (const booking of expiredBookings) {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            depositStatus: 'EXPIRED',
            notes: booking.notes 
              ? `${booking.notes}\nCancelled: deposit payment not received`
              : 'Cancelled: deposit payment not received',
          },
        });

        await tx.depositPayment.updateMany({
          where: { bookingId: booking.id, status: 'pending' },
          data: { status: 'expired' },
        });
      });

      expiredCount++;

      if (booking.business.phoneNumber) {
        try {
          const message = `Your hold for ${booking.serviceName} has been released because the deposit was not received. Please text again if you would like to reschedule.`;

          await sendSms({
            to: booking.clientPhone,
            from: booking.business.phoneNumber.phoneNumber,
            body: message,
          });

          notifiedCount++;
        } catch (error) {
          console.error(`Failed to send expiry notification for booking ${booking.id}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      notified: notifiedCount,
    });
  } catch (error) {
    console.error('Deposit expiry cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
