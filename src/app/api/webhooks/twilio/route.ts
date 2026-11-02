import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature } from '@/services/twilio';
import { processIncomingMessage } from '@/services/ai-conversation';
import { evaluateInboundPolicy, notifyUsageThreshold, recordSmsUsage } from '@/services/usage';
import { claimWaitlistOffer, findActiveWaitlistOffer } from '@/services/waitlist';
import { confirmBookingByYes, findPendingYes, isAffirmativeReply } from '@/services/confirmation';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const signature = request.headers.get('x-twilio-signature') || '';
    const url = request.url;

    if (process.env.NODE_ENV === 'production') {
      const isValid = validateTwilioSignature(signature, url, params);
      if (!isValid) {
        console.error('Invalid Twilio signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { From: from, To: to, Body: body } = params;

    if (!from || !to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { phoneNumber: to },
      include: { business: true },
    });

    if (!phoneNumber || !phoneNumber.business) {
      console.error(`No business found for phone number: ${to}`);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!phoneNumber.isActive || !phoneNumber.business.isActive) {
      return NextResponse.json({ error: 'Business is not active' }, { status: 403 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        businessId_clientPhone: {
          businessId: phoneNumber.businessId,
          clientPhone: from,
        },
      },
    });

    const policy = await evaluateInboundPolicy({
      businessId: phoneNumber.businessId,
      clientPhone: from,
      conversationState: conversation?.state,
    });

    let reply: string | null = null;

    if (isAffirmativeReply(body)) {
      const offer = await findActiveWaitlistOffer(phoneNumber.businessId, from);
      if (offer) {
        const claimed = await claimWaitlistOffer({
          businessId: phoneNumber.businessId,
          clientPhone: from,
        });
        reply = claimed.message;
      } else {
        const pendingYes = await findPendingYes(phoneNumber.businessId, from);
        if (pendingYes) {
          const confirmed = await confirmBookingByYes({
            businessId: phoneNumber.businessId,
            clientPhone: from,
          });
          reply = confirmed.message;
        }
      }
    }

    if (!reply) {
      if (policy.atCap && !policy.allow) {
        reply = `Thanks for texting ${phoneNumber.business.name}. We are at this month's messaging allowance and the owner is upgrading. We will text you as soon as we are back.`;
      } else {
        const result = await processIncomingMessage(phoneNumber.businessId, from, body);
        reply = result.response;
      }
    }

    const usage = await recordSmsUsage({
      businessId: phoneNumber.businessId,
      inboundBody: body,
      outboundBody: reply,
    });

    if (usage.justHitWarn) {
      await notifyUsageThreshold({
        businessId: phoneNumber.businessId,
        used: usage.used,
        cap: usage.cap,
        tier: usage.tier,
        kind: 'warning',
      });
    }
    if (usage.justHitCap) {
      await notifyUsageThreshold({
        businessId: phoneNumber.businessId,
        used: usage.used,
        cap: usage.cap,
        tier: usage.tier,
        kind: 'reached',
      });
    }

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${escapeXml(reply)}</Message>
      </Response>`,
      {
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Sorry, something went wrong. Please try again.</Message>
      </Response>`,
      {
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
