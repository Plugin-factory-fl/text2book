import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { purchasePhoneNumber } from '@/services/twilio';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.phoneNumber.findUnique({
      where: { businessId: business.id },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Business already has a phone number' },
        { status: 400 }
      );
    }

    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const webhookUrl = `${process.env.APP_URL}/api/webhooks/twilio`;

    const purchased = await purchasePhoneNumber(phoneNumber, webhookUrl);

    const phoneRecord = await prisma.phoneNumber.create({
      data: {
        businessId: business.id,
        twilioSid: purchased.sid,
        phoneNumber: purchased.phoneNumber,
        friendlyName: purchased.friendlyName,
      },
    });

    return NextResponse.json(phoneRecord, { status: 201 });
  } catch (error) {
    console.error('Provision phone number error:', error);
    return NextResponse.json(
      { error: 'Failed to provision phone number' },
      { status: 500 }
    );
  }
}
