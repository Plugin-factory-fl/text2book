import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { id } = await params;

    const client = await prisma.trustedClient.findFirst({
      where: {
        id,
        businessId: business.id,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Trusted client not found' },
        { status: 404 }
      );
    }

    await prisma.trustedClient.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete trusted client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, notes } = body;

    const client = await prisma.trustedClient.findFirst({
      where: {
        id,
        businessId: business.id,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Trusted client not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.trustedClient.update({
      where: { id },
      data: {
        name: name !== undefined ? name : client.name,
        notes: notes !== undefined ? notes : client.notes,
      },
    });

    return NextResponse.json({ client: updated });
  } catch (error) {
    console.error('Failed to update trusted client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
