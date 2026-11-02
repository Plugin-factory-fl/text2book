/**
 * Assistant Tools Service
 * 
 * Provides tool calling capabilities for the owner's Chief Assistant.
 * These tools allow full CRUD operations on all business entities.
 * 
 * SECURITY: These tools are OWNER-ONLY and must never be exposed to client conversation bots.
 */

import prisma from '@/lib/prisma';
import { createBooking, cancelBooking, rescheduleBooking, CreateBookingParams } from './booking';
import { format, parseISO, addMinutes } from 'date-fns';
import { extractBusinessInfo } from './business-import';
import { applyExtractedBusinessInfo } from './business-import-apply';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

export interface AssistantToolContext {
  businessId: string;
  userId: string;
}

// === SERVICE TOOLS ===

export async function listServices(ctx: AssistantToolContext): Promise<ToolResult> {
  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { sortOrder: 'asc' },
  });

  return {
    success: true,
    message: `Found ${services.length} services`,
    data: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration,
      price: s.price,
      isActive: s.isActive,
      depositOverride: s.depositOverride,
    })),
  };
}

export async function createService(
  ctx: AssistantToolContext,
  params: {
    name: string;
    description?: string;
    duration: number;
    price: number;
    depositOverride?: number | null;
  }
): Promise<ToolResult> {
  const service = await prisma.service.create({
    data: {
      businessId: ctx.businessId,
      name: params.name,
      description: params.description || null,
      duration: params.duration,
      price: params.price,
      depositOverride: params.depositOverride,
    },
  });

  return {
    success: true,
    message: `Created service "${service.name}" at $${params.price} for ${params.duration} minutes`,
    data: { id: service.id, name: service.name },
  };
}

export async function updateService(
  ctx: AssistantToolContext,
  params: {
    serviceId: string;
    name?: string;
    description?: string;
    duration?: number;
    price?: number;
    isActive?: boolean;
    depositOverride?: number | null;
  }
): Promise<ToolResult> {
  const existing = await prisma.service.findFirst({
    where: { id: params.serviceId, businessId: ctx.businessId },
  });

  if (!existing) {
    return { success: false, message: 'Service not found' };
  }

  const service = await prisma.service.update({
    where: { id: params.serviceId },
    data: {
      name: params.name,
      description: params.description,
      duration: params.duration,
      price: params.price,
      isActive: params.isActive,
      depositOverride: params.depositOverride,
    },
  });

  return {
    success: true,
    message: `Updated service "${service.name}"`,
    data: { id: service.id, name: service.name },
  };
}

export async function deleteService(
  ctx: AssistantToolContext,
  serviceId: string,
  confirmed: boolean = false
): Promise<ToolResult> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: ctx.businessId },
  });

  if (!service) {
    return { success: false, message: 'Service not found' };
  }

  if (!confirmed) {
    return {
      success: false,
      message: `Are you sure you want to delete "${service.name}"?`,
      requiresConfirmation: true,
      confirmationPrompt: `Delete service "${service.name}"`,
    };
  }

  await prisma.service.delete({ where: { id: serviceId } });

  return {
    success: true,
    message: `Deleted service "${service.name}"`,
  };
}

// === AVAILABILITY/HOURS TOOLS ===

export async function getAvailability(ctx: AssistantToolContext): Promise<ToolResult> {
  const rules = await prisma.availabilityRule.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { dayOfWeek: 'asc' },
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formatted = rules.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    dayName: dayNames[r.dayOfWeek],
    startTime: r.startTime,
    endTime: r.endTime,
    isActive: r.isActive,
  }));

  return {
    success: true,
    message: `Retrieved availability for ${rules.length} days`,
    data: formatted,
  };
}

export async function updateAvailability(
  ctx: AssistantToolContext,
  params: {
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
    isActive?: boolean;
  }
): Promise<ToolResult> {
  const existing = await prisma.availabilityRule.findFirst({
    where: { businessId: ctx.businessId, dayOfWeek: params.dayOfWeek },
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[params.dayOfWeek];

  if (existing) {
    await prisma.availabilityRule.update({
      where: { id: existing.id },
      data: {
        startTime: params.startTime,
        endTime: params.endTime,
        isActive: params.isActive,
      },
    });
  } else {
    await prisma.availabilityRule.create({
      data: {
        businessId: ctx.businessId,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime || '09:00',
        endTime: params.endTime || '17:00',
        isActive: params.isActive ?? true,
      },
    });
  }

  return {
    success: true,
    message: `Updated ${dayName} hours`,
  };
}

// === BUSINESS INFO/FAQ TOOLS ===

export async function getBusinessInfo(ctx: AssistantToolContext): Promise<ToolResult> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    include: { faqs: true },
  });

  if (!business) {
    return { success: false, message: 'Business not found' };
  }

  return {
    success: true,
    message: 'Retrieved business info',
    data: {
      name: business.name,
      category: business.category,
      description: business.description,
      phone: business.phone,
      email: business.email,
      address: business.address,
      city: business.city,
      state: business.state,
      zipCode: business.zipCode,
      cancellationPolicy: business.cancellationPolicy,
      faqs: business.faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
      })),
    },
  };
}

export async function updateBusinessInfo(
  ctx: AssistantToolContext,
  params: {
    name?: string;
    category?: string;
    description?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    cancellationPolicy?: string;
  }
): Promise<ToolResult> {
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: params,
  });

  return {
    success: true,
    message: 'Updated business information',
  };
}

export async function createFaq(
  ctx: AssistantToolContext,
  params: { question: string; answer: string }
): Promise<ToolResult> {
  const faq = await prisma.fAQ.create({
    data: {
      businessId: ctx.businessId,
      question: params.question,
      answer: params.answer,
    },
  });

  return {
    success: true,
    message: `Added FAQ: "${params.question}"`,
    data: { id: faq.id },
  };
}

export async function updateFaq(
  ctx: AssistantToolContext,
  params: { faqId: string; question?: string; answer?: string }
): Promise<ToolResult> {
  const existing = await prisma.fAQ.findFirst({
    where: { id: params.faqId, businessId: ctx.businessId },
  });

  if (!existing) {
    return { success: false, message: 'FAQ not found' };
  }

  await prisma.fAQ.update({
    where: { id: params.faqId },
    data: {
      question: params.question,
      answer: params.answer,
    },
  });

  return {
    success: true,
    message: 'Updated FAQ',
  };
}

export async function deleteFaq(
  ctx: AssistantToolContext,
  faqId: string,
  confirmed: boolean = false
): Promise<ToolResult> {
  const faq = await prisma.fAQ.findFirst({
    where: { id: faqId, businessId: ctx.businessId },
  });

  if (!faq) {
    return { success: false, message: 'FAQ not found' };
  }

  if (!confirmed) {
    return {
      success: false,
      message: `Delete FAQ "${faq.question}"?`,
      requiresConfirmation: true,
      confirmationPrompt: 'Delete this FAQ',
    };
  }

  await prisma.fAQ.delete({ where: { id: faqId } });

  return {
    success: true,
    message: 'Deleted FAQ',
  };
}

// === DEPOSIT SETTINGS TOOLS ===

export async function getDepositSettings(ctx: AssistantToolContext): Promise<ToolResult> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
  });

  if (!business) {
    return { success: false, message: 'Business not found' };
  }

  return {
    success: true,
    message: 'Retrieved deposit settings',
    data: {
      depositsEnabled: business.depositsEnabled,
      defaultDepositAmount: business.defaultDepositAmount,
      depositHoldMinutes: business.depositHoldMinutes,
      depositPolicyText: business.depositPolicyText,
    },
  };
}

export async function updateDepositSettings(
  ctx: AssistantToolContext,
  params: {
    depositsEnabled?: boolean;
    defaultDepositAmount?: number;
    depositHoldMinutes?: number;
    depositPolicyText?: string;
  }
): Promise<ToolResult> {
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: params,
  });

  return {
    success: true,
    message: 'Updated deposit settings',
  };
}

// === TRUSTED CLIENTS TOOLS ===

export async function listTrustedClients(ctx: AssistantToolContext): Promise<ToolResult> {
  const clients = await prisma.trustedClient.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    success: true,
    message: `Found ${clients.length} trusted clients`,
    data: clients.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      notes: c.notes,
    })),
  };
}

export async function addTrustedClient(
  ctx: AssistantToolContext,
  params: { phone: string; name?: string; notes?: string }
): Promise<ToolResult> {
  const existing = await prisma.trustedClient.findFirst({
    where: {
      businessId: ctx.businessId,
      phone: { contains: params.phone.slice(-10) },
    },
  });

  if (existing) {
    return { success: false, message: 'Client is already trusted' };
  }

  const client = await prisma.trustedClient.create({
    data: {
      businessId: ctx.businessId,
      phone: params.phone,
      name: params.name,
      notes: params.notes,
    },
  });

  return {
    success: true,
    message: `Added ${params.name || params.phone} as trusted client`,
    data: { id: client.id },
  };
}

export async function removeTrustedClient(
  ctx: AssistantToolContext,
  phone: string,
  confirmed: boolean = false
): Promise<ToolResult> {
  const client = await prisma.trustedClient.findFirst({
    where: {
      businessId: ctx.businessId,
      phone: { contains: phone.slice(-10) },
    },
  });

  if (!client) {
    return { success: false, message: 'Trusted client not found' };
  }

  if (!confirmed) {
    return {
      success: false,
      message: `Remove ${client.name || client.phone} from trusted clients?`,
      requiresConfirmation: true,
      confirmationPrompt: 'Remove trusted client',
    };
  }

  await prisma.trustedClient.delete({ where: { id: client.id } });

  return {
    success: true,
    message: `Removed ${client.name || client.phone} from trusted clients`,
  };
}

// === BOOKING TOOLS ===

export async function listBookings(
  ctx: AssistantToolContext,
  params?: { upcoming?: boolean; clientPhone?: string; limit?: number }
): Promise<ToolResult> {
  const where: any = { businessId: ctx.businessId };

  if (params?.upcoming) {
    where.startTime = { gte: new Date() };
    where.status = { in: ['CONFIRMED', 'AWAITING_DEPOSIT'] };
  }

  if (params?.clientPhone) {
    where.clientPhone = { contains: params.clientPhone.slice(-10) };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startTime: 'asc' },
    take: params?.limit || 20,
  });

  return {
    success: true,
    message: `Found ${bookings.length} bookings`,
    data: bookings.map((b) => ({
      id: b.id,
      clientName: b.clientName,
      clientPhone: b.clientPhone,
      serviceName: b.serviceName,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      status: b.status,
      depositStatus: b.depositStatus,
    })),
  };
}

export async function createBookingTool(
  ctx: AssistantToolContext,
  params: {
    serviceId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    startTime: string;
    notes?: string;
  },
  confirmed: boolean = false
): Promise<ToolResult> {
  const service = await prisma.service.findFirst({
    where: { id: params.serviceId, businessId: ctx.businessId },
  });

  if (!service) {
    return { success: false, message: 'Service not found' };
  }

  const startTime = parseISO(params.startTime);

  if (!confirmed) {
    return {
      success: false,
      message: `Book ${service.name} for ${params.clientName} on ${format(startTime, 'EEEE, MMMM d')} at ${format(startTime, 'h:mm a')}?`,
      requiresConfirmation: true,
      confirmationPrompt: 'Create this booking',
    };
  }

  const result = await createBooking({
    businessId: ctx.businessId,
    serviceId: params.serviceId,
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    clientEmail: params.clientEmail,
    startTime,
    notes: params.notes,
  });

  if (!result.success) {
    return { success: false, message: result.error || 'Failed to create booking' };
  }

  return {
    success: true,
    message: `Booked ${service.name} for ${params.clientName} on ${format(startTime, 'EEEE, MMMM d')} at ${format(startTime, 'h:mm a')}`,
    data: result.booking,
  };
}

export async function cancelBookingTool(
  ctx: AssistantToolContext,
  bookingId: string,
  reason?: string,
  confirmed: boolean = false
): Promise<ToolResult> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: ctx.businessId },
  });

  if (!booking) {
    return { success: false, message: 'Booking not found' };
  }

  if (!confirmed) {
    return {
      success: false,
      message: `Cancel ${booking.clientName}'s ${booking.serviceName} on ${format(booking.startTime, 'MMMM d')}? This will notify the client.`,
      requiresConfirmation: true,
      confirmationPrompt: 'Cancel this booking',
    };
  }

  const result = await cancelBooking(bookingId, reason);

  if (!result.success) {
    return { success: false, message: result.error || 'Failed to cancel booking' };
  }

  return {
    success: true,
    message: `Cancelled ${booking.clientName}'s booking`,
  };
}

export async function rescheduleBookingTool(
  ctx: AssistantToolContext,
  params: { bookingId: string; newStartTime: string },
  confirmed: boolean = false
): Promise<ToolResult> {
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, businessId: ctx.businessId },
  });

  if (!booking) {
    return { success: false, message: 'Booking not found' };
  }

  const newStartTime = parseISO(params.newStartTime);

  if (!confirmed) {
    return {
      success: false,
      message: `Reschedule ${booking.clientName}'s ${booking.serviceName} from ${format(booking.startTime, 'MMMM d')} to ${format(newStartTime, 'EEEE, MMMM d')} at ${format(newStartTime, 'h:mm a')}? This will notify the client.`,
      requiresConfirmation: true,
      confirmationPrompt: 'Reschedule this booking',
    };
  }

  const result = await rescheduleBooking(params.bookingId, newStartTime);

  if (!result.success) {
    return { success: false, message: result.error || 'Failed to reschedule booking' };
  }

  return {
    success: true,
    message: `Rescheduled ${booking.clientName}'s booking to ${format(newStartTime, 'EEEE, MMMM d')} at ${format(newStartTime, 'h:mm a')}`,
    data: result.booking,
  };
}

// === REMINDER SETTINGS TOOLS ===

export async function getReminderSettings(ctx: AssistantToolContext): Promise<ToolResult> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
  });

  if (!business) {
    return { success: false, message: 'Business not found' };
  }

  return {
    success: true,
    message: 'Retrieved reminder settings',
    data: {
      reminderHoursBefore: business.reminderHoursBefore,
    },
  };
}

export async function updateReminderSettings(
  ctx: AssistantToolContext,
  params: { reminderHoursBefore: number }
): Promise<ToolResult> {
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { reminderHoursBefore: params.reminderHoursBefore },
  });

  return {
    success: true,
    message: `Reminders will now be sent ${params.reminderHoursBefore} hours before appointments`,
  };
}

// === CLIENT TOOLS ===

export async function getClientInfo(
  ctx: AssistantToolContext,
  clientPhone: string
): Promise<ToolResult> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      businessId: ctx.businessId,
      clientPhone: { contains: clientPhone.slice(-10) },
    },
    include: {
      bookings: { orderBy: { startTime: 'desc' }, take: 10 },
    },
  });

  if (!conversation) {
    return { success: false, message: 'Client not found' };
  }

  const trusted = await prisma.trustedClient.findFirst({
    where: {
      businessId: ctx.businessId,
      phone: { contains: clientPhone.slice(-10) },
    },
  });

  const completedBookings = conversation.bookings.filter((b) => b.status === 'COMPLETED');
  const totalSpent = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  return {
    success: true,
    message: `Found client ${conversation.clientName || clientPhone}`,
    data: {
      phone: conversation.clientPhone,
      name: conversation.clientName,
      isTrusted: !!trusted,
      totalVisits: completedBookings.length,
      totalSpent,
      recentBookings: conversation.bookings.slice(0, 5).map((b) => ({
        serviceName: b.serviceName,
        startTime: b.startTime.toISOString(),
        status: b.status,
      })),
    },
  };
}

export async function updateClientName(
  ctx: AssistantToolContext,
  params: { clientPhone: string; name: string }
): Promise<ToolResult> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      businessId: ctx.businessId,
      clientPhone: { contains: params.clientPhone.slice(-10) },
    },
  });

  if (!conversation) {
    return { success: false, message: 'Client not found' };
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { clientName: params.name },
  });

  return {
    success: true,
    message: `Updated client name to "${params.name}"`,
  };
}

export async function importBusinessInfoTool(
  ctx: AssistantToolContext,
  url: string,
  confirmed?: boolean
): Promise<ToolResult> {
  if (!url) {
    return { success: false, message: 'Provide a website URL to import from' };
  }

  const result = await extractBusinessInfo({ url });

  if (!confirmed) {
    return {
      success: true,
      requiresConfirmation: true,
      confirmationPrompt: `I extracted business info from ${url}. Name: ${result.extracted.businessName || 'unknown'}. Confirm to apply it. Nothing is saved until you confirm.`,
      data: result.extracted,
    };
  }

  const applied = await applyExtractedBusinessInfo(ctx.businessId, result.extracted, {
    businessName: true,
    description: true,
    address: true,
    city: true,
    state: true,
    zipCode: true,
    phone: true,
    cancellationPolicy: true,
    depositPolicy: true,
    hours: true,
    services: true,
    faqs: true,
  });

  return {
    success: true,
    message: `Imported business info from ${url}. Updated ${applied.updatedFields.join(', ') || 'no fields'}.`,
    data: applied,
  };
}

export async function recordInPersonPaymentTool(ctx: AssistantToolContext, bookingId: string): Promise<ToolResult> {
  const { recordInPersonPayment } = await import('./payments');
  const result = await recordInPersonPayment({ businessId: ctx.businessId, bookingId, actor: 'owner' });
  if (!result.success) return { success: false, message: result.error || 'Could not record payment' };
  return { success: true, message: `Recorded $${((result.amountCents || 0) / 100).toFixed(2)} paid in person.` };
}

export async function markPaymentOutstandingTool(ctx: AssistantToolContext, bookingId: string): Promise<ToolResult> {
  const { markPaymentOutstanding } = await import('./payments');
  const result = await markPaymentOutstanding({ businessId: ctx.businessId, bookingId, actor: 'owner' });
  if (!result.success) return { success: false, message: result.error || 'Could not mark outstanding' };
  return { success: true, message: 'Marked as outstanding. I drafted a reminder that is only sent if you approve.', data: { draft: result.draftFollowup } };
}

export async function listWaitlistTool(ctx: AssistantToolContext): Promise<ToolResult> {
  const { listWaitlist } = await import('./waitlist');
  const entries = await listWaitlist(ctx.businessId);
  return { success: true, message: `${entries.length} people on the waitlist`, data: entries };
}

export async function addWaitlistTool(
  ctx: AssistantToolContext,
  params: { clientPhone: string; clientName?: string; serviceName?: string; preferredDate?: string; windowStart?: string; windowEnd?: string }
): Promise<ToolResult> {
  const { joinWaitlist } = await import('./waitlist');
  const entry = await joinWaitlist({
    businessId: ctx.businessId,
    clientPhone: params.clientPhone,
    clientName: params.clientName,
    serviceName: params.serviceName,
    preferredDate: params.preferredDate ? new Date(params.preferredDate) : undefined,
    windowStart: params.windowStart,
    windowEnd: params.windowEnd,
  });
  return { success: true, message: `Added to the waitlist at position ${entry.position}`, data: entry };
}

export async function removeWaitlistTool(ctx: AssistantToolContext, entryId: string, confirmed = false): Promise<ToolResult> {
  if (!confirmed) {
    return {
      success: false,
      message: 'Remove this waitlist entry?',
      requiresConfirmation: true,
      confirmationPrompt: 'Remove waitlist entry',
    };
  }
  await prisma.waitlistEntry.updateMany({
    where: { id: entryId, businessId: ctx.businessId },
    data: { status: 'CANCELLED' },
  });
  return { success: true, message: 'Removed from the waitlist' };
}

export async function getUsageTool(ctx: AssistantToolContext): Promise<ToolResult> {
  const { getBusinessTier, getOrCreateUsagePeriod } = await import('./usage');
  const { PLAN_TIERS } = await import('@/config/pricing');
  const tier = await getBusinessTier(ctx.businessId);
  const period = await getOrCreateUsagePeriod(ctx.businessId);
  const used = period.inboundSegments + period.outboundSegments;
  const cap = PLAN_TIERS[tier].includedSegments;
  return {
    success: true,
    message: `${PLAN_TIERS[tier].name} plan: ${used} of ${cap} text segments used this month`,
    data: { tier, used, cap },
  };
}

export async function getAuditLogTool(ctx: AssistantToolContext, clientPhone: string): Promise<ToolResult> {
  const { listAuditForClient } = await import('./audit');
  const logs = await listAuditForClient(ctx.businessId, clientPhone);
  return { success: true, message: `${logs.length} audit events`, data: logs };
}

export async function importCsvTool(
  ctx: AssistantToolContext,
  params: { csv: string; kind: 'clients' | 'services' | 'appointments'; presetId?: string; confirmed?: boolean }
): Promise<ToolResult> {
  const { parseCsv, previewImport, detectPreset, IMPORT_PRESETS } = await import('./csv-import');
  const parsed = parseCsv(params.csv || '');
  const preset = params.presetId
    ? IMPORT_PRESETS.find((p) => p.id === params.presetId)
    : detectPreset(parsed.headers);
  if (!preset) {
    return { success: false, message: 'Could not match a CSV preset. Try Square, Vagaro, Booksy, Fresha, GlossGenius, Acuity, or Calendly headers.' };
  }
  const preview = previewImport({ kind: params.kind, rows: parsed.rows, mapping: preset.mapping });
  if (!params.confirmed) {
    return {
      success: true,
      requiresConfirmation: true,
      confirmationPrompt: `Preview: ${preview.kept} new rows, ${preview.duplicates} duplicates with ${preset.name}. Confirm to save.`,
      data: { kept: preview.kept, duplicates: preview.duplicates, sample: preview.rows.slice(0, 5) },
    };
  }
  return { success: true, message: 'Open Business Info to finish the CSV import with preview and save.' };
}

// === TOOL DEFINITIONS FOR OPENAI ===

export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'List all services offered by the business',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_service',
      description: 'Create a new service',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Service name' },
          description: { type: 'string', description: 'Service description' },
          duration: { type: 'number', description: 'Duration in minutes' },
          price: { type: 'number', description: 'Price in dollars' },
          depositOverride: { type: 'number', description: 'Deposit amount in cents, null for default, 0 for no deposit' },
        },
        required: ['name', 'duration', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_service',
      description: 'Update an existing service (price, duration, name, etc.)',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'Service ID' },
          name: { type: 'string', description: 'New service name' },
          description: { type: 'string', description: 'New description' },
          duration: { type: 'number', description: 'New duration in minutes' },
          price: { type: 'number', description: 'New price in dollars' },
          isActive: { type: 'boolean', description: 'Whether service is active' },
          depositOverride: { type: 'number', description: 'Deposit amount in cents' },
        },
        required: ['serviceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_service',
      description: 'Delete a service',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string', description: 'Service ID to delete' },
          confirmed: { type: 'boolean', description: 'Confirm deletion' },
        },
        required: ['serviceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Get business hours/availability for each day of the week',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_availability',
      description: 'Update business hours for a specific day',
      parameters: {
        type: 'object',
        properties: {
          dayOfWeek: { type: 'number', description: 'Day of week (0=Sunday, 6=Saturday)' },
          startTime: { type: 'string', description: 'Opening time (HH:MM format)' },
          endTime: { type: 'string', description: 'Closing time (HH:MM format)' },
          isActive: { type: 'boolean', description: 'Whether open on this day' },
        },
        required: ['dayOfWeek'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_info',
      description: 'Get business details and FAQs',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_business_info',
      description: 'Update business details (name, address, policies, etc.)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zipCode: { type: 'string' },
          cancellationPolicy: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_faq',
      description: 'Add a new FAQ entry',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question' },
          answer: { type: 'string', description: 'The answer' },
        },
        required: ['question', 'answer'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_faq',
      description: 'Update an existing FAQ',
      parameters: {
        type: 'object',
        properties: {
          faqId: { type: 'string' },
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['faqId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_faq',
      description: 'Delete an FAQ entry',
      parameters: {
        type: 'object',
        properties: {
          faqId: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['faqId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_deposit_settings',
      description: 'Get deposit/payment settings',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_deposit_settings',
      description: 'Update deposit settings',
      parameters: {
        type: 'object',
        properties: {
          depositsEnabled: { type: 'boolean' },
          defaultDepositAmount: { type: 'number', description: 'Amount in cents' },
          depositHoldMinutes: { type: 'number' },
          depositPolicyText: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_trusted_clients',
      description: 'List clients who are exempt from deposits',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_trusted_client',
      description: 'Add a client to the trusted list (exempt from deposits)',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Client phone number' },
          name: { type: 'string', description: 'Client name' },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_trusted_client',
      description: 'Remove a client from the trusted list',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_bookings',
      description: 'List bookings, optionally filtered',
      parameters: {
        type: 'object',
        properties: {
          upcoming: { type: 'boolean', description: 'Only show upcoming bookings' },
          clientPhone: { type: 'string', description: 'Filter by client phone' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Create a new booking',
      parameters: {
        type: 'object',
        properties: {
          serviceId: { type: 'string' },
          clientName: { type: 'string' },
          clientPhone: { type: 'string' },
          clientEmail: { type: 'string' },
          startTime: { type: 'string', description: 'ISO 8601 datetime' },
          notes: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['serviceId', 'clientName', 'clientPhone', 'startTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancel an existing booking',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          reason: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['bookingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_booking',
      description: 'Reschedule a booking to a new time',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          newStartTime: { type: 'string', description: 'New ISO 8601 datetime' },
          confirmed: { type: 'boolean' },
        },
        required: ['bookingId', 'newStartTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reminder_settings',
      description: 'Get appointment reminder settings',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_reminder_settings',
      description: 'Update reminder timing',
      parameters: {
        type: 'object',
        properties: {
          reminderHoursBefore: { type: 'number', description: 'Hours before appointment to send reminder' },
        },
        required: ['reminderHoursBefore'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_info',
      description: 'Get detailed info about a specific client',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string' },
        },
        required: ['clientPhone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_client_name',
      description: 'Update a client name',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['clientPhone', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_in_person_payment',
      description: 'Record that a client paid the remainder in person',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
        },
        required: ['bookingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_payment_outstanding',
      description: 'Mark a booking remainder as unpaid and draft a reminder',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
        },
        required: ['bookingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_waitlist',
      description: 'List active waitlist entries',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_waitlist_entry',
      description: 'Add a client to the waitlist',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string' },
          clientName: { type: 'string' },
          serviceName: { type: 'string' },
          preferredDate: { type: 'string' },
          windowStart: { type: 'string' },
          windowEnd: { type: 'string' },
        },
        required: ['clientPhone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_waitlist_entry',
      description: 'Remove a waitlist entry',
      parameters: {
        type: 'object',
        properties: {
          entryId: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['entryId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_usage',
      description: 'Get this month text usage versus the plan allowance',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_audit_log',
      description: 'Get AI action history for a client',
      parameters: {
        type: 'object',
        properties: {
          clientPhone: { type: 'string' },
        },
        required: ['clientPhone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_csv',
      description: 'Preview or apply a CSV import of clients, services, or appointments. Requires confirmation before saving.',
      parameters: {
        type: 'object',
        properties: {
          csv: { type: 'string', description: 'Raw CSV text' },
          kind: { type: 'string', enum: ['clients', 'services', 'appointments'] },
          presetId: { type: 'string' },
          confirmed: { type: 'boolean' },
        },
        required: ['csv', 'kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_business_info',
      description: 'Import business details from a website URL. Requires confirmation before saving anything.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Public http(s) website URL' },
          confirmed: { type: 'boolean', description: 'Confirm applying the extracted values' },
        },
        required: ['url'],
      },
    },
  },
];

// === TOOL EXECUTOR ===

export async function executeAssistantTool(
  ctx: AssistantToolContext,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case 'list_services':
      return listServices(ctx);
    case 'create_service':
      return createService(ctx, args as any);
    case 'update_service':
      return updateService(ctx, args as any);
    case 'delete_service':
      return deleteService(ctx, args.serviceId as string, args.confirmed as boolean);
    case 'get_availability':
      return getAvailability(ctx);
    case 'update_availability':
      return updateAvailability(ctx, args as any);
    case 'get_business_info':
      return getBusinessInfo(ctx);
    case 'update_business_info':
      return updateBusinessInfo(ctx, args as any);
    case 'create_faq':
      return createFaq(ctx, args as any);
    case 'update_faq':
      return updateFaq(ctx, args as any);
    case 'delete_faq':
      return deleteFaq(ctx, args.faqId as string, args.confirmed as boolean);
    case 'get_deposit_settings':
      return getDepositSettings(ctx);
    case 'update_deposit_settings':
      return updateDepositSettings(ctx, args as any);
    case 'list_trusted_clients':
      return listTrustedClients(ctx);
    case 'add_trusted_client':
      return addTrustedClient(ctx, args as any);
    case 'remove_trusted_client':
      return removeTrustedClient(ctx, args.phone as string, args.confirmed as boolean);
    case 'list_bookings':
      return listBookings(ctx, args as any);
    case 'create_booking':
      return createBookingTool(ctx, args as any, args.confirmed as boolean);
    case 'cancel_booking':
      return cancelBookingTool(ctx, args.bookingId as string, args.reason as string, args.confirmed as boolean);
    case 'reschedule_booking':
      return rescheduleBookingTool(ctx, args as any, args.confirmed as boolean);
    case 'get_reminder_settings':
      return getReminderSettings(ctx);
    case 'update_reminder_settings':
      return updateReminderSettings(ctx, args as any);
    case 'get_client_info':
      return getClientInfo(ctx, args.clientPhone as string);
    case 'update_client_name':
      return updateClientName(ctx, args as any);
    case 'import_business_info':
      return importBusinessInfoTool(ctx, args.url as string, args.confirmed as boolean);
    case 'record_in_person_payment':
      return recordInPersonPaymentTool(ctx, args.bookingId as string);
    case 'mark_payment_outstanding':
      return markPaymentOutstandingTool(ctx, args.bookingId as string);
    case 'list_waitlist':
      return listWaitlistTool(ctx);
    case 'add_waitlist_entry':
      return addWaitlistTool(ctx, args as any);
    case 'remove_waitlist_entry':
      return removeWaitlistTool(ctx, args.entryId as string, args.confirmed as boolean);
    case 'get_usage':
      return getUsageTool(ctx);
    case 'get_audit_log':
      return getAuditLogTool(ctx, args.clientPhone as string);
    case 'import_csv':
      return importCsvTool(ctx, args as any);
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}
