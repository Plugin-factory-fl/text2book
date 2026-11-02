import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/services/twilio';
import { buildForwardDialTwiml, handleMissedCall } from '@/services/missed-call';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-twilio-signature') || '';
      if (!validateTwilioSignature(signature, request.url, params)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const to = params.To;
    const from = params.From;
    if (!to || !from) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { phoneNumber: to },
      include: { business: true },
    });

    if (!phoneNumber?.business?.missedCallTextBackEnabled) {
      return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`);
    }

    const ownerPhone = phoneNumber.business.ownerForwardPhone || phoneNumber.business.phone;
    const statusUrl = `${process.env.APP_URL}/api/webhooks/twilio/voice/status`;

    if (ownerPhone) {
      return twiml(
        buildForwardDialTwiml({
          ownerPhone,
          statusCallbackUrl: statusUrl,
        })
      );
    }

    await handleMissedCall({ toNumber: to, fromNumber: from });
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Please text this number to book. Goodbye.</Say></Response>`);
  } catch (error) {
    console.error('Twilio voice webhook error:', error);
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong.</Say></Response>`);
  }
}

function twiml(body: string) {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml' } });
}
