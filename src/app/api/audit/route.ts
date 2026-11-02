import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness } from '@/lib/auth';
import { listAuditForClient } from '@/services/audit';

export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const phone = request.nextUrl.searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }
    const logs = await listAuditForClient(business.id, phone);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
