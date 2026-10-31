import { Business, Service, AvailabilityRule, FAQ } from '@prisma/client';
import { format } from 'date-fns';

export interface ConversationContext {
  clientName?: string;
  clientPhone: string;
  requestedService?: string;
  requestedTime?: string;
  proposedSlots?: Array<{ start: string; end: string; formatted: string }>;
  pendingBooking?: {
    serviceId: string;
    serviceName: string;
    startTime: string;
    endTime: string;
    duration: number;
    price?: number;
  };
  lastIntent?: string;
}

export interface MessageHistory {
  role: 'user' | 'assistant';
  content: string;
}

export interface BusinessContext {
  business: Business;
  services: Service[];
  availabilityRules: AvailabilityRule[];
  faqs: FAQ[];
}

export function buildSystemPrompt(context: BusinessContext): string {
  const { business, services, availabilityRules, faqs } = context;

  const serviceList = services
    .filter((s) => s.isActive)
    .map((s) => {
      let desc = `- ${s.name} (${s.duration} minutes`;
      if (s.price) desc += `, $${s.price.toFixed(2)}`;
      desc += ')';
      if (s.description) desc += `: ${s.description}`;
      return desc;
    })
    .join('\n');

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hoursMap: Record<number, string[]> = {};
  
  availabilityRules
    .filter((r) => r.isActive)
    .forEach((rule) => {
      const timeRange = `${rule.startTime} to ${rule.endTime}`;
      if (!hoursMap[rule.dayOfWeek]) hoursMap[rule.dayOfWeek] = [];
      hoursMap[rule.dayOfWeek].push(timeRange);
    });

  const hoursList = Object.entries(hoursMap)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([day, times]) => `- ${daysOfWeek[parseInt(day)]}: ${times.join(', ')}`)
    .join('\n');

  const faqList = faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join('\n\n');

  return `You are a friendly and professional booking assistant for ${business.name}${business.category ? `, a ${business.category} business` : ''}.

BUSINESS INFORMATION:
- Name: ${business.name}
${business.address ? `- Address: ${business.address}${business.city ? `, ${business.city}` : ''}${business.state ? `, ${business.state}` : ''} ${business.zipCode || ''}` : ''}
${business.phone ? `- Phone: ${business.phone}` : ''}
${business.email ? `- Email: ${business.email}` : ''}
${business.cancellationPolicy ? `- Cancellation Policy: ${business.cancellationPolicy}` : ''}

SERVICES OFFERED:
${serviceList || 'No services configured yet.'}

BUSINESS HOURS:
${hoursList || 'Hours not configured yet.'}

${faqList ? `FREQUENTLY ASKED QUESTIONS:\n${faqList}` : ''}

YOUR ROLE AND BEHAVIOR:
1. Greet clients warmly and help them book appointments
2. When a client wants to book, ask what service they need if not specified
3. When you know the service, ask for their preferred day/time
4. ALWAYS check actual availability before confirming any time (use the check_availability function)
5. If requested time is unavailable, offer alternative times from the available slots
6. Collect the client's name before finalizing the booking
7. Confirm all details before booking: service, date, time, and name
8. NEVER double book - always verify slot is available
9. Handle cancellations and reschedules politely
10. Answer FAQs directly when asked

RESPONSE STYLE:
- Keep responses SHORT and natural (this is SMS)
- Be friendly but professional
- Use simple language, no jargon
- One or two sentences max when possible
- Never use dashes in your responses
- If you cannot help with something, say "I will have the owner get back to you"

CURRENT DATE: ${format(new Date(), 'EEEE, MMMM d, yyyy')}`;
}

export function buildUserContextPrompt(
  conversationContext: ConversationContext,
  availableSlots?: Array<{ start: string; formatted: string }>
): string {
  let context = '';

  if (conversationContext.clientName) {
    context += `Client Name: ${conversationContext.clientName}\n`;
  }
  context += `Client Phone: ${conversationContext.clientPhone}\n`;

  if (conversationContext.requestedService) {
    context += `Requested Service: ${conversationContext.requestedService}\n`;
  }

  if (conversationContext.requestedTime) {
    context += `Requested Time: ${conversationContext.requestedTime}\n`;
  }

  if (availableSlots && availableSlots.length > 0) {
    context += `\nAVAILABLE SLOTS FOR REQUESTED DATE:\n`;
    context += availableSlots.slice(0, 6).map((s) => `- ${s.formatted}`).join('\n');
    context += '\n';
  }

  if (conversationContext.pendingBooking) {
    context += `\nPENDING BOOKING TO CONFIRM:\n`;
    context += `- Service: ${conversationContext.pendingBooking.serviceName}\n`;
    context += `- Time: ${conversationContext.pendingBooking.startTime}\n`;
    context += `- Duration: ${conversationContext.pendingBooking.duration} minutes\n`;
    if (conversationContext.pendingBooking.price) {
      context += `- Price: $${conversationContext.pendingBooking.price.toFixed(2)}\n`;
    }
  }

  return context;
}

export function buildConversationPrompt(
  messageHistory: MessageHistory[],
  currentMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages = messageHistory.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({
    role: 'user',
    content: currentMessage,
  });

  return messages;
}

export const BOOKING_FUNCTIONS = [
  {
    name: 'check_availability',
    description: 'Check available appointment slots for a specific date and service',
    parameters: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'The name of the service to book',
        },
        date: {
          type: 'string',
          description: 'The date to check in YYYY-MM-DD format',
        },
      },
      required: ['service_name', 'date'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a confirmed booking after collecting all required information',
    parameters: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'The name of the service',
        },
        client_name: {
          type: 'string',
          description: 'The client full name',
        },
        start_time: {
          type: 'string',
          description: 'The appointment start time in ISO format',
        },
      },
      required: ['service_name', 'client_name', 'start_time'],
    },
  },
  {
    name: 'get_upcoming_booking',
    description: 'Get the upcoming booking for this client to check what they have scheduled',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel the upcoming booking for this client. Use after confirming with the client they want to cancel.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Optional reason for cancellation',
        },
      },
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Reschedule the upcoming booking for this client to a new time. First check availability, then reschedule.',
    parameters: {
      type: 'object',
      properties: {
        new_start_time: {
          type: 'string',
          description: 'The new appointment start time in ISO format',
        },
      },
      required: ['new_start_time'],
    },
  },
  {
    name: 'escalate_to_owner',
    description: 'When you cannot handle the request, escalate to the business owner',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the request needs human attention',
        },
      },
      required: ['reason'],
    },
  },
];
