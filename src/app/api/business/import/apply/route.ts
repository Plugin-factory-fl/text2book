import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { extractedBusinessSchema } from '@/services/business-import';
import { applyExtractedBusinessInfo, AcceptedImport } from '@/services/business-import-apply';

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const extractedParse = extractedBusinessSchema.safeParse(body.extracted);
    if (!extractedParse.success) {
      return NextResponse.json({ error: 'Invalid extracted data' }, { status: 400 });
    }

    const accepted = (body.accepted || {}) as AcceptedImport;
    const hasAny = Object.values(accepted).some((value) => value === true);
    if (!hasAny) {
      return NextResponse.json({ error: 'Select at least one field to apply' }, { status: 400 });
    }

    const result = await applyExtractedBusinessInfo(business.id, extractedParse.data, accepted);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Business import apply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply imported information' },
      { status: 500 }
    );
  }
}
