import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  createConnectedAccount,
  createAccountOnboardingLink,
  getAccountStatus,
} from '@/services/stripe-connect';

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

    const status = await getAccountStatus(business.id);

    if ('error' in status) {
      return NextResponse.json({ error: status.error }, { status: 500 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get connect account status:', error);
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { business: true },
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const accountResult = await createConnectedAccount(
      user.business.id,
      user.email
    );

    if ('error' in accountResult) {
      return NextResponse.json({ error: accountResult.error }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/dashboard/settings?connect=success`;
    const refreshUrl = `${appUrl}/dashboard/settings?connect=refresh`;

    const linkResult = await createAccountOnboardingLink(
      user.business.id,
      returnUrl,
      refreshUrl
    );

    if ('error' in linkResult) {
      return NextResponse.json({ error: linkResult.error }, { status: 400 });
    }

    return NextResponse.json({ url: linkResult.url });
  } catch (error) {
    console.error('Failed to create connect account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
