import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/services/twilio';
import { handleMissedCall, missedCallStatuses } from '@/services/missed-call';

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

    const dialStatus = params.DialCallStatus || params.CallStatus || '';
    const from = params.From;
    const to = params.To;

    if (from && to && missedCallStatuses().includes(dialStatus)) {
      await handleMissedCall({ toNumber: to, fromNumber: from });
    }

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('Twilio voice status error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
