import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId: business.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        state: 'OWNER_TAKEOVER',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Takeover error:', error);
    return NextResponse.json(
      { error: 'Failed to take over conversation' },
      { status: 500 }
    );
  }
}
