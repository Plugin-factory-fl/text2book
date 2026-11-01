import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { SsrfError } from '@/lib/ssrf';
import { extractBusinessInfo } from '@/services/business-import';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 4_000_000;

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let url: string | undefined;
    let file: { buffer: Buffer; filename: string; mimeType?: string } | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      url = String(form.get('url') || '').trim() || undefined;
      const uploaded = form.get('file');
      if (uploaded instanceof File) {
        if (uploaded.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json({ error: 'File is too large (4 MB max)' }, { status: 400 });
        }
        file = {
          buffer: Buffer.from(await uploaded.arrayBuffer()),
          filename: uploaded.name,
          mimeType: uploaded.type,
        };
      }
    } else {
      const body = await request.json();
      url = typeof body.url === 'string' ? body.url.trim() : undefined;
    }

    if (!url && !file) {
      return NextResponse.json(
        { error: 'Provide a website URL or upload a document' },
        { status: 400 }
      );
    }

    const result = await extractBusinessInfo({ url, file });

    return NextResponse.json({
      extracted: result.extracted,
      sourceUrls: result.sourceUrls,
      sourceTextPreview: result.sourceTextPreview,
      current: {
        businessName: business.name,
        description: business.description,
        address: business.address,
        city: business.city,
        state: business.state,
        zipCode: business.zipCode,
        phone: business.phone,
        cancellationPolicy: business.cancellationPolicy,
        depositPolicy: business.depositPolicyText,
      },
    });
  } catch (error) {
    if (error instanceof SsrfError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Business import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract business information' },
      { status: 500 }
    );
  }
}
