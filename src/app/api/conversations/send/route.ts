import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendSms } from '@/services/twilio';

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId, message } = await request.json();

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'Missing conversationId or message' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId: business.id,
      },
      include: {
        business: {
          include: {
            phoneNumber: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (!conversation.business.phoneNumber) {
      return NextResponse.json(
        { error: 'Business phone number not configured' },
        { status: 400 }
      );
    }

    await sendSms({
      to: conversation.clientPhone,
      from: conversation.business.phoneNumber.phoneNumber,
      body: message,
    });

    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: message,
        isAi: false,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastActivity: new Date(),
        state: 'OWNER_TAKEOVER',
      },
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
