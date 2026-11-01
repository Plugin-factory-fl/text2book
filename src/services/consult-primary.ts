/**
 * Consult Primary Service
 * 
 * Handles communication between conversation bots and the primary (owner) assistant.
 * All consultations are logged as internal notes and responses are sanitized.
 */

import prisma from '@/lib/prisma';
import { sanitizeForConversationBot, detectPromptInjection } from './agent-context';

/**
 * Conversation bot consults the primary assistant.
 * The response is sanitized before being returned.
 */
export async function consultPrimary(
  conversationId: string,
  question: string,
  clientPhone: string,
  clientName?: string
): Promise<{ response: string; wasFiltered: boolean }> {
  const injection = detectPromptInjection(question);
  if (injection.isInjection) {
    await logPromptInjectionAttempt(conversationId, question, injection.reason || 'Unknown');
    return {
      response: 'I can help you with booking appointments, checking availability, and answering questions about our services.',
      wasFiltered: true,
    };
  }

  await prisma.internalNote.create({
    data: {
      conversationId,
      noteType: 'CONSULT',
      content: question,
      fromAgent: 'conversation_bot',
      toAgent: 'primary_assistant',
    },
  });

  const primaryResponse = await generatePrimaryResponse(conversationId, question);

  const sanitized = sanitizeForConversationBot(primaryResponse, clientPhone, clientName);

  await prisma.internalNote.create({
    data: {
      conversationId,
      noteType: 'RESPONSE',
      content: primaryResponse,
      fromAgent: 'primary_assistant',
      toAgent: 'conversation_bot',
      wasFiltered: sanitized.wasFiltered,
      filterReason: sanitized.filterReason,
    },
  });

  return {
    response: sanitized.sanitized,
    wasFiltered: sanitized.wasFiltered,
  };
}

/**
 * Generate a response from the primary assistant.
 * Consult sanitizing is local (no LLM call). If a model is added for consult
 * sanitizing or rewrite, use OPENAI_MODEL_CLIENT from @/lib/openai.
 */
async function generatePrimaryResponse(conversationId: string, question: string): Promise<string> {
  const directives = await getActiveDirectives(conversationId);
  
  if (directives.length > 0) {
    return `Based on the owner's instructions: ${directives[0]}`;
  }

  return 'I can help with that booking request. Let me check the schedule.';
}

/**
 * Owner sends a directive for a specific conversation.
 */
export async function sendOwnerDirective(
  conversationId: string,
  directive: string,
  expiresAt?: Date
): Promise<void> {
  await prisma.ownerDirective.create({
    data: {
      conversationId,
      directive,
      expiresAt,
    },
  });

  await prisma.internalNote.create({
    data: {
      conversationId,
      noteType: 'DIRECTIVE',
      content: directive,
      fromAgent: 'owner',
      toAgent: 'conversation_bot',
    },
  });
}

/**
 * Get active directives for a conversation.
 */
export async function getActiveDirectives(conversationId: string): Promise<string[]> {
  const now = new Date();
  const directives = await prisma.ownerDirective.findMany({
    where: {
      conversationId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  return directives.map((d) => d.directive);
}

/**
 * Log a prompt injection attempt.
 */
export async function logPromptInjectionAttempt(
  conversationId: string,
  attemptedMessage: string,
  reason: string
): Promise<void> {
  await prisma.internalNote.create({
    data: {
      conversationId,
      noteType: 'INJECTION_ATTEMPT',
      content: `BLOCKED: ${attemptedMessage}\nReason: ${reason}`,
      fromAgent: 'client',
      toAgent: 'conversation_bot',
      wasFiltered: true,
      filterReason: reason,
    },
  });
}

/**
 * Escalate a conversation to the owner.
 */
export async function escalateToOwner(
  conversationId: string,
  reason: string
): Promise<void> {
  await prisma.internalNote.create({
    data: {
      conversationId,
      noteType: 'ESCALATION',
      content: reason,
      fromAgent: 'conversation_bot',
      toAgent: 'owner',
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { state: 'ESCALATE' },
  });
}

/**
 * Get internal notes for a conversation (owner view only).
 */
export async function getInternalNotes(conversationId: string) {
  return prisma.internalNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}
