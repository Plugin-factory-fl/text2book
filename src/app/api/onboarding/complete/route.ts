import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.business.id },
      include: {
        services: true,
        availabilityRules: true,
        phoneNumber: true,
        calendarConnection: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const issues: string[] = [];

    if (!business.name) {
      issues.push('Business name is required');
    }

    if (business.services.length === 0) {
      issues.push('At least one service is required');
    }

    if (business.availabilityRules.length === 0) {
      issues.push('Business hours must be set');
    }

    if (!business.calendarConnection) {
      issues.push('Google Calendar must be connected');
    }

    if (!business.phoneNumber) {
      issues.push('A phone number must be provisioned');
    }

    if (issues.length > 0) {
      return NextResponse.json({ 
        complete: false, 
        issues 
      }, { status: 400 });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: { onboardingComplete: true },
    });

    return NextResponse.json({ complete: true });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
