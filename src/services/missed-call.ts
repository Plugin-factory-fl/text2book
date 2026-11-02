import prisma from '@/lib/prisma';
import { sendSms } from './twilio';
import { logAudit } from './audit';

export const DEFAULT_MISSED_CALL_MESSAGE =
  'Hi, you just called {business}. This is the booking assistant. How can I help you today? You can text a service and a day that works.';

export function renderMissedCallMessage(template: string | null | undefined, businessName: string): string {
  const source = (template && template.trim()) || DEFAULT_MISSED_CALL_MESSAGE;
  return source.replace(/\{business\}/g, businessName);
}

export async function handleMissedCall(params: {
  toNumber: string;
  fromNumber: string;
}): Promise<{ sent: boolean; body?: string }> {
  const phoneNumber = await prisma.phoneNumber.findUnique({
    where: { phoneNumber: params.toNumber },
    include: { business: true },
  });

  if (!phoneNumber?.business || !phoneNumber.business.missedCallTextBackEnabled) {
    return { sent: false };
  }

  const body = renderMissedCallMessage(
    phoneNumber.business.missedCallMessage,
    phoneNumber.business.name
  );

  let conversation = await prisma.conversation.findUnique({
    where: {
      businessId_clientPhone: {
        businessId: phoneNumber.businessId,
        clientPhone: params.fromNumber,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId: phoneNumber.businessId,
        clientPhone: params.fromNumber,
        state: 'GREETING',
        context: { lastIntent: 'missed_call' },
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      content: body,
      isAi: true,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastActivity: new Date() },
  });

  try {
    await sendSms({
      to: params.fromNumber,
      from: phoneNumber.phoneNumber,
      body,
    });
  } catch (error) {
    console.error('Failed to send missed call text back:', error);
    return { sent: false };
  }

  await logAudit({
    businessId: phoneNumber.businessId,
    action: 'MISSED_CALL_TEXTBACK',
    actor: 'system',
    summary: 'Sent missed call text back and started a booking chat',
    clientPhone: params.fromNumber,
  });

  return { sent: true, body };
}

export function buildForwardDialTwiml(params: {
  ownerPhone: string;
  statusCallbackUrl: string;
  timeoutSeconds?: number;
}): string {
  const timeout = params.timeoutSeconds ?? 20;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${timeout}" action="${escapeXml(params.statusCallbackUrl)}" method="POST">
    <Number>${escapeXml(params.ownerPhone)}</Number>
  </Dial>
</Response>`;
}

export function missedCallStatuses(): string[] {
  return ['no-answer', 'busy', 'failed', 'canceled'];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
