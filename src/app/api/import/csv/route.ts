import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { detectPreset, IMPORT_PRESETS, parseCsv, previewImport, normalizePhone } from '@/services/csv-import';
import { createBooking } from '@/services/booking';

export async function GET() {
  return NextResponse.json({ presets: IMPORT_PRESETS });
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const csvText = String(body.csv || '');
    const kind = body.kind || 'clients';
    const mapping = body.mapping;
    const apply = Boolean(body.apply);

    const parsed = parseCsv(csvText);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
    }

    const preset = body.presetId
      ? IMPORT_PRESETS.find((p) => p.id === body.presetId)
      : detectPreset(parsed.headers);
    const usedMapping = mapping || preset?.mapping;
    if (!usedMapping) {
      return NextResponse.json({
        headers: parsed.headers,
        presets: IMPORT_PRESETS,
        error: 'Choose a preset or column mapping',
      }, { status: 400 });
    }

    const existingClients = await prisma.conversation.findMany({
      where: { businessId: business.id },
      select: { clientPhone: true },
    });
    const existingServices = await prisma.service.findMany({
      where: { businessId: business.id },
      select: { name: true },
    });

    const preview = previewImport({
      kind,
      rows: parsed.rows,
      mapping: usedMapping,
      existingPhones: existingClients.map((c) => c.clientPhone),
      existingServiceNames: existingServices.map((s) => s.name),
    });

    if (!apply) {
      return NextResponse.json({
        headers: parsed.headers,
        preset: preset || null,
        preview: preview.rows.slice(0, 50),
        kept: preview.kept,
        duplicates: preview.duplicates,
      });
    }

    let created = 0;
    for (const row of preview.rows) {
      if (row.duplicate) continue;
      if (kind === 'clients') {
        const phone = normalizePhone(row.data.phone || '');
        if (!phone) continue;
        await prisma.conversation.upsert({
          where: {
            businessId_clientPhone: { businessId: business.id, clientPhone: phone },
          },
          create: {
            businessId: business.id,
            clientPhone: phone,
            clientName: row.data.name || null,
            state: 'GREETING',
            context: {},
          },
          update: {
            clientName: row.data.name || undefined,
          },
        });
        created++;
      } else if (kind === 'services') {
        const duration = parseInt(row.data.duration, 10);
        if (!row.data.name || !duration) continue;
        await prisma.service.create({
          data: {
            businessId: business.id,
            name: row.data.name,
            duration,
            price: row.data.price ? parseFloat(row.data.price) : null,
            description: row.data.description || null,
          },
        });
        created++;
      } else if (kind === 'appointments') {
        const phone = normalizePhone(row.data.clientPhone || '');
        const startTime = row.data.startTime ? new Date(row.data.startTime) : null;
        if (!phone || !startTime || Number.isNaN(startTime.getTime())) continue;
        let service = await prisma.service.findFirst({
          where: { businessId: business.id, name: row.data.serviceName || undefined },
        });
        if (!service) {
          service = await prisma.service.findFirst({
            where: { businessId: business.id, isActive: true },
          });
        }
        if (!service) continue;
        await createBooking({
          businessId: business.id,
          serviceId: service.id,
          clientName: row.data.clientName || 'Imported client',
          clientPhone: phone,
          clientEmail: row.data.email,
          startTime,
          createdByAi: false,
          requireYesConfirm: false,
        });
        created++;
      }
    }

    return NextResponse.json({ applied: true, created, skipped: preview.duplicates });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 });
  }
}
