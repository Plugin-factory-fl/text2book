import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature, sendSms } from '@/services/twilio';
import { processIncomingMessage } from '@/services/ai-conversation';
import { notifyOwnerSmsCap } from '@/services/notifications';
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

    const { From: from, To: to, Body: body, MessageSid: messageSid } = params;

    if (!from || !to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { phoneNumber: to },
      include: {
        business: {
          include: { 
            services: { where: { isActive: true } },
            availabilityRules: { where: { isActive: true } },
            faqs: true,
          },
        },
      },
    });

    if (!phoneNumber || !phoneNumber.business) {
      console.error(`No business found for phone number: ${to}`);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!phoneNumber.isActive || !phoneNumber.business.isActive) {
      return NextResponse.json({ error: 'Business is not active' }, { status: 403 });
    }

    const now = new Date();
    const lastReset = phoneNumber.lastMonthlyReset;
    const monthsSinceReset =
      (now.getFullYear() - lastReset.getFullYear()) * 12 +
      (now.getMonth() - lastReset.getMonth());

    if (monthsSinceReset >= 1) {
      await prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: {
          monthlySmsSent: 0,
          lastMonthlyReset: now,
        },
      });
    }

    const smsCapReached = phoneNumber.monthlySmsSent >= phoneNumber.monthlySmsCap;
    const smsCapWarning = phoneNumber.monthlySmsSent >= phoneNumber.monthlySmsCap * 0.8;
    
    if (smsCapReached) {
      console.warn(`SMS cap reached for business: ${phoneNumber.businessId}`);
      
      await notifyOwnerSmsCap(
        phoneNumber.businessId,
        'reached',
        phoneNumber.monthlySmsSent,
        phoneNumber.monthlySmsCap
      );
      
      const conversation = await getOrCreateConversation(phoneNumber.businessId, from);
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: body,
        },
      });
      
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>We have reached our messaging limit for this month. Please contact ${phoneNumber.business.name} directly${phoneNumber.business.phone ? ` at ${phoneNumber.business.phone}` : ''} to book your appointment. We apologize for the inconvenience!</Message>
        </Response>`,
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    if (smsCapWarning && phoneNumber.monthlySmsSent === Math.floor(phoneNumber.monthlySmsCap * 0.8)) {
      await notifyOwnerSmsCap(
        phoneNumber.businessId,
        'warning',
        phoneNumber.monthlySmsSent,
        phoneNumber.monthlySmsCap
      );
    }

    const result = await processIncomingMessage(
      phoneNumber.businessId,
      from,
      body
    );

    await prisma.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: {
        monthlySmsSent: { increment: 2 },
      },
    });

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${escapeXml(result.response)}</Message>
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

async function getOrCreateConversation(businessId: string, clientPhone: string) {
  let conversation = await prisma.conversation.findUnique({
    where: {
      businessId_clientPhone: {
        businessId,
        clientPhone,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        clientPhone,
        state: 'GREETING',
        context: {},
      },
    });
  }

  return conversation;
}
