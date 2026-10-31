import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const faqSchema = z.object({
  question: z.string().min(1, 'Question is required').max(200),
  answer: z.string().min(1, 'Answer is required').max(1000),
  sortOrder: z.number().optional(),
});

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const faqs = await prisma.fAQ.findMany({
      where: { businessId: business.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(faqs);
  } catch (error) {
    console.error('Get FAQs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FAQs' },
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
    const validation = faqSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { question, answer, sortOrder } = validation.data;

    const faq = await prisma.fAQ.create({
      data: {
        businessId: business.id,
        question,
        answer,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    console.error('Create FAQ error:', error);
    return NextResponse.json(
      { error: 'Failed to create FAQ' },
      { status: 500 }
    );
  }
}
