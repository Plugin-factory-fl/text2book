import prisma from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

export async function logAudit(params: {
  businessId: string;
  action: AuditAction;
  actor: 'ai' | 'owner' | 'system' | 'client';
  summary: string;
  clientPhone?: string | null;
  bookingId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId,
        action: params.action,
        actor: params.actor,
        summary: params.summary,
        clientPhone: params.clientPhone || null,
        bookingId: params.bookingId || null,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export async function listAuditForClient(businessId: string, clientPhone: string) {
  return prisma.auditLog.findMany({
    where: { businessId, clientPhone },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
