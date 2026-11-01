import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    const trustedClients = await prisma.trustedClient.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ clients: trustedClients });
  } catch (error) {
    console.error('Failed to fetch trusted clients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { phone, name, notes } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const formattedPhone = normalizedPhone.startsWith('1') 
      ? `+${normalizedPhone}` 
      : `+1${normalizedPhone}`;

    const existing = await prisma.trustedClient.findUnique({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: formattedPhone,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This client is already trusted' },
        { status: 400 }
      );
    }

    const client = await prisma.trustedClient.create({
      data: {
        businessId: business.id,
        phone: formattedPhone,
        name: name || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error('Failed to add trusted client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
