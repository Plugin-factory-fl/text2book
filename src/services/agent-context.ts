/**
 * Agent Context Builders
 * 
 * This module provides typed, server-side enforced context builders for the agent hierarchy.
 * The client-facing conversation bot ONLY receives client-safe data.
 * The primary (owner) assistant has full business access.
 * 
 * SECURITY: Never expose revenue, other clients' data, or client counts to conversation bots.
 */

import prisma from '@/lib/prisma';

/**
 * Client-safe context that can be given to a conversation bot.
 * This is a WHITELIST - only these fields are allowed.
 */
export interface ClientSafeContext {
  business: {
    name: string;
    timezone: string;
    reminderHoursBefore: number;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    duration: number;
    price: number;
    isActive: boolean;
    depositRequired: boolean;
    depositAmount: number | null;
  }>;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  depositPolicy: {
    enabled: boolean;
    defaultAmount: number;
    holdMinutes: number;
    policyText: string;
  };
  thisClient: {
    phone: string;
    name: string | null;
    isTrusted: boolean;
    upcomingBookings: Array<{
      id: string;
      serviceName: string;
      startTime: Date;
      endTime: Date;
      status: string;
      depositStatus: string;
      depositAmount: number | null;
    }>;
    pastBookingCount: number;
  };
}

/**
 * Owner-only context with full business access.
 * This is NEVER exposed to conversation bots.
 */
export interface OwnerContext extends ClientSafeContext {
  metrics: {
    totalClients: number;
    activeConversations: number;
    conversationsNeedingAttention: number;
    unpaidDeposits: number;
    todayBookings: number;
    upcomingBookings: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
  };
  allClients: Array<{
    phone: string;
    name: string | null;
    conversationId: string;
    state: string;
    lastActivity: Date;
    upcomingBookingCount: number;
    lifetimeRevenue: number;
    visitCount: number;
    noShowCount: number;
  }>;
  recentEscalations: Array<{
    conversationId: string;
    clientName: string | null;
    clientPhone: string;
    reason: string;
    timestamp: Date;
  }>;
  ownerDirectives: Record<string, string[]>;
}

/**
 * Build a client-safe context for a conversation bot.
 * This enforces the data whitelist at the service level.
 */
export async function buildClientSafeContext(
  businessId: string,
  clientPhone: string
): Promise<ClientSafeContext> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      services: { where: { isActive: true } },
      availabilityRules: { where: { isActive: true } },
      faqs: true,
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      businessId_clientPhone: { businessId, clientPhone },
    },
  });

  const trusted = await prisma.trustedClient.findFirst({
    where: {
      businessId,
      phone: { contains: clientPhone.slice(-10) },
    },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      clientPhone: { contains: clientPhone.slice(-10) },
    },
    orderBy: { startTime: 'desc' },
  });

  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) => b.startTime > now && ['CONFIRMED', 'AWAITING_DEPOSIT'].includes(b.status)
  );
  const pastBookingCount = bookings.filter(
    (b) => b.startTime <= now || b.status === 'COMPLETED'
  ).length;

  return {
    business: {
      name: business.name,
      timezone: business.timezone,
      reminderHoursBefore: business.reminderHoursBefore,
    },
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration,
      price: s.price || 0,
      isActive: s.isActive,
      depositRequired: s.depositOverride !== 0 && (s.depositOverride !== null || business.depositsEnabled),
      depositAmount: s.depositOverride ?? business.defaultDepositAmount,
    })),
    availability: business.availabilityRules.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      isActive: a.isActive,
    })),
    faqs: business.faqs.map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    depositPolicy: {
      enabled: business.depositsEnabled,
      defaultAmount: business.defaultDepositAmount || 0,
      holdMinutes: business.depositHoldMinutes,
      policyText: business.depositPolicyText || 'The deposit is non-refundable on no-show and will be applied toward your service.',
    },
    thisClient: {
      phone: clientPhone,
      name: conversation?.clientName || null,
      isTrusted: !!trusted,
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        serviceName: b.serviceName,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        depositStatus: b.depositStatus,
        depositAmount: b.depositAmount,
      })),
      pastBookingCount,
    },
  };
}

/**
 * Build full owner context with all business data.
 * This is ONLY for the primary assistant.
 */
export async function buildOwnerContext(businessId: string): Promise<OwnerContext> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      services: { where: { isActive: true } },
      availabilityRules: { where: { isActive: true } },
      faqs: true,
      conversations: {
        include: {
          bookings: true,
        },
        orderBy: { lastActivity: 'desc' },
      },
      bookings: {
        orderBy: { startTime: 'desc' },
      },
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const todayBookings = business.bookings.filter(
    (b) => b.startTime >= todayStart && b.startTime <= todayEnd && b.status === 'CONFIRMED'
  ).length;

  const upcomingBookings = business.bookings.filter(
    (b) => b.startTime > now && ['CONFIRMED', 'AWAITING_DEPOSIT'].includes(b.status)
  ).length;

  const unpaidDeposits = business.bookings.filter(
    (b) => b.depositStatus === 'PENDING'
  ).length;

  const revenueThisMonth = business.bookings
    .filter((b) => b.startTime >= monthStart && b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const revenueLastMonth = business.bookings
    .filter(
      (b) =>
        b.startTime >= lastMonthStart &&
        b.startTime <= lastMonthEnd &&
        b.status === 'COMPLETED'
    )
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const needsAttention = business.conversations.filter(
    (c) => c.state === 'ESCALATE'
  ).length;

  const escalations = await prisma.internalNote.findMany({
    where: {
      conversation: { businessId },
      noteType: 'ESCALATION',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { conversation: true },
  });

  const ownerDirectives = await prisma.ownerDirective.findMany({
    where: {
      conversation: { businessId },
      isActive: true,
    },
    include: { conversation: true },
  });

  const directivesByConv: Record<string, string[]> = {};
  for (const d of ownerDirectives) {
    if (!directivesByConv[d.conversationId]) {
      directivesByConv[d.conversationId] = [];
    }
    directivesByConv[d.conversationId].push(d.directive);
  }

  const clientBase = await buildClientSafeContext(businessId, '+10000000000');

  return {
    ...clientBase,
    metrics: {
      totalClients: business.conversations.length,
      activeConversations: business.conversations.filter(
        (c) => c.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      conversationsNeedingAttention: needsAttention,
      unpaidDeposits,
      todayBookings,
      upcomingBookings,
      revenueThisMonth,
      revenueLastMonth,
    },
    allClients: business.conversations.map((c) => {
      const clientBookings = c.bookings || [];
      const completed = clientBookings.filter((b) => b.status === 'COMPLETED');
      return {
        phone: c.clientPhone,
        name: c.clientName,
        conversationId: c.id,
        state: c.state,
        lastActivity: c.lastActivity,
        upcomingBookingCount: clientBookings.filter(
          (b) => b.startTime > now && ['CONFIRMED', 'AWAITING_DEPOSIT'].includes(b.status)
        ).length,
        lifetimeRevenue: completed.reduce((sum, b) => sum + (b.price || 0), 0),
        visitCount: completed.length,
        noShowCount: clientBookings.filter((b) => b.status === 'NO_SHOW').length,
      };
    }),
    recentEscalations: escalations.map((e) => ({
      conversationId: e.conversationId,
      clientName: e.conversation.clientName,
      clientPhone: e.conversation.clientPhone,
      reason: e.content,
      timestamp: e.createdAt,
    })),
    ownerDirectives: directivesByConv,
  };
}

/**
 * Sensitive data patterns that must never appear in client-facing responses.
 */
const SENSITIVE_PATTERNS = [
  /\$[\d,]+\.?\d*\s*(revenue|earned|made|income)/i,
  /revenue[:\s]+\$?[\d,]+/i,
  /revenue.+\$[\d,]+/i,
  /\$[\d,]+.+clients?/i,
  /\d+\s*(clients?|customers?|people)\s*(total|booked|today|this\s+month)/i,
  /\d+\s*(clients?|customers?|people)\s+have\s+booked/i,
  /(have|had)\s+\d+\s*(clients?|customers?|people)/i,
  /(total|all)\s*(clients?|customers?)/i,
  /client\s*(count|number|total)/i,
  /other\s*(clients?|customers?|appointments?|bookings?)/i,
  /someone\s*else('s)?\s*(appointment|booking)/i,
  /another\s+client/i,
  /[\w\s]+'s\s*(appointment|booking|schedule)/i,
];

/**
 * Names and phone patterns to strip from sanitized responses.
 */
function containsSensitiveData(text: string, allowedClientName?: string): boolean {
  const normalized = text.toLowerCase();
  
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  const phonePattern = /\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const phones = text.match(phonePattern);
  if (phones && phones.length > 0) {
    return true;
  }

  return false;
}

/**
 * Sanitize a response from the primary bot before sending to a conversation bot.
 * This ensures no sensitive owner data leaks to clients.
 */
export function sanitizeForConversationBot(
  response: string,
  clientPhone: string,
  clientName?: string
): { sanitized: string; wasFiltered: boolean; filterReason?: string } {
  if (containsSensitiveData(response, clientName || undefined)) {
    return {
      sanitized: 'I can help with that. Let me provide the relevant information for your booking.',
      wasFiltered: true,
      filterReason: 'Response contained sensitive business data',
    };
  }

  return {
    sanitized: response,
    wasFiltered: false,
  };
}

/**
 * Validate that a context object is client-safe (contains no owner-only data).
 * Used in tests to verify data isolation.
 */
export function validateClientSafeContext(context: unknown): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];
  const obj = context as Record<string, unknown>;

  if ('metrics' in obj) {
    violations.push('Context contains metrics (owner-only)');
  }
  if ('allClients' in obj) {
    violations.push('Context contains allClients (owner-only)');
  }
  if ('recentEscalations' in obj) {
    violations.push('Context contains recentEscalations (owner-only)');
  }
  if ('ownerDirectives' in obj) {
    violations.push('Context contains ownerDirectives (owner-only)');
  }

  const jsonStr = JSON.stringify(context);
  if (/revenue/i.test(jsonStr) && !/revenueThisMonth|revenueLastMonth/i.test(jsonStr) === false) {
    if ('metrics' in obj) {
      violations.push('Context contains revenue data');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Check if a message contains a prompt injection attempt.
 */
export function detectPromptInjection(message: string): { isInjection: boolean; reason?: string } {
  const injectionPatterns = [
    /(please\s+)?ignore\s+(all\s+)?(previous\s+)?(your\s+)?instructions/i,
    /forget\s+(everything|all|your)\s*(instructions|rules|guidelines)?/i,
    /you\s+are\s+now\s+a/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /act\s+as\s+(if|though)/i,
    /reveal\s+(your|the)\s*(system|instructions|prompt)/i,
    /tell\s+me\s+(how\s+many|about\s+other)\s*(clients|customers|people)/i,
    /how\s+many\s+(clients|customers|people)\s+(do\s+you\s+have|are\s+there|total)/i,
    /what('s|\s+is)\s+(your|the)\s*(revenue|income|earnings)/i,
    /list\s+all\s*(clients|customers|bookings)/i,
    /show\s+me\s+other\s+(clients|customers|appointments)/i,
    /\badmin\s+mode\b|\boverride\s+security\b|\bsudo\s+access\b|\bbypass\s+restrictions\b/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(message)) {
      return {
        isInjection: true,
        reason: `Detected potential prompt injection: ${pattern.source}`,
      };
    }
  }

  return { isInjection: false };
}
