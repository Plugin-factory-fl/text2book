import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const businessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(100),
  category: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  timezone: z.string().optional(),
  cancellationPolicy: z.string().max(500).optional(),
  reminderHoursBefore: z.number().min(1).max(72).optional(),
  depositsEnabled: z.boolean().optional(),
  defaultDepositAmount: z.number().min(0).max(100000).optional().nullable(),
  depositHoldMinutes: z.number().min(5).max(1440).optional(),
  depositPolicyText: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.business) {
      return NextResponse.json({ business: null });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.business.id },
      include: {
        phoneNumber: true,
        calendarConnection: {
          select: {
            provider: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            services: true,
            availabilityRules: true,
            faqs: true,
            bookings: true,
          },
        },
      },
    });

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.business) {
      return NextResponse.json(
        { error: 'Business already exists' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = businessSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const business = await prisma.business.create({
      data: {
        userId: user.id,
        ...validation.data,
        email: validation.data.email || null,
      },
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    console.error('Create business error:', error);
    return NextResponse.json(
      { error: 'Failed to create business' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = businessSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const business = await prisma.business.update({
      where: { id: user.business.id },
      data: {
        ...validation.data,
        email: validation.data.email || null,
      },
    });

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Update business error:', error);
    return NextResponse.json(
      { error: 'Failed to update business' },
      { status: 500 }
    );
  }
}
