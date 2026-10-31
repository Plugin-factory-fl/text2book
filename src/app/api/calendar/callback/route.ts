import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/services/calendar';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/settings?calendar=error', process.env.APP_URL!)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?calendar=error', process.env.APP_URL!)
      );
    }

    let businessId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      businessId = decoded.businessId;
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?calendar=error', process.env.APP_URL!)
      );
    }

    const tokens = await exchangeCodeForTokens(code);

    await prisma.calendarConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendarId: 'primary',
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
      },
    });

    return NextResponse.redirect(
      new URL('/dashboard/settings?calendar=connected', process.env.APP_URL!)
    );
  } catch (error) {
    console.error('Calendar callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings?calendar=error', process.env.APP_URL!)
    );
  }
}
