import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  isActive: z.boolean().optional(),
});

const bulkUpdateSchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().optional(),
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
      isActive: z.boolean().optional(),
    })
  ),
});

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.availabilityRule.findMany({
      where: { businessId: business.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Get availability error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = availabilitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { dayOfWeek, startTime, endTime, isActive } = validation.data;

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    const rule = await prisma.availabilityRule.create({
      data: {
        businessId: business.id,
        dayOfWeek,
        startTime,
        endTime,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Create availability rule error:', error);
    return NextResponse.json(
      { error: 'Failed to create availability rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = bulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await prisma.availabilityRule.deleteMany({
      where: { businessId: business.id },
    });

    const rules = await prisma.availabilityRule.createMany({
      data: validation.data.rules.map((rule) => ({
        businessId: business.id,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        isActive: rule.isActive ?? true,
      })),
    });

    const createdRules = await prisma.availabilityRule.findMany({
      where: { businessId: business.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(createdRules);
  } catch (error) {
    console.error('Bulk update availability error:', error);
    return NextResponse.json(
      { error: 'Failed to update availability rules' },
      { status: 500 }
    );
  }
}
