import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { OPENAI_LIMITS, OPENAI_MODEL_CLIENT, requireOpenAIClient, trimConversationHistory } from '@/lib/openai';
import {
  buildSystemPrompt,
  buildUserContextPrompt,
  buildConversationPrompt,
  BOOKING_FUNCTIONS,
  BusinessContext,
  ConversationContext,
  MessageHistory,
} from '@/prompts/booking-assistant';
import { getAvailableSlots, formatSlotForDisplay, TimeSlot } from './calendar';
import { createBooking, cancelBookingByClientPhone, rescheduleBookingByClientPhone, findUpcomingBookingByClientPhone } from './booking';
import { format, parse, addDays, startOfDay, parseISO } from 'date-fns';
import { ConversationState } from '@prisma/client';

function getOpenAIClient(): OpenAI {
  return requireOpenAIClient();
}

export interface ProcessMessageResult {
  response: string;
  newState?: ConversationState;
  bookingCreated?: boolean;
  bookingId?: string;
}

export async function processIncomingMessage(
  businessId: string,
  clientPhone: string,
  message: string
): Promise<ProcessMessageResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      services: { where: { isActive: true } },
      availabilityRules: { where: { isActive: true } },
      faqs: true,
    },
  });

  if (!business) {
    return { response: 'Sorry, this business is not available.' };
  }

  let conversation = await prisma.conversation.findUnique({
    where: {
      businessId_clientPhone: {
        businessId,
        clientPhone,
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 40,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        clientPhone,
        state: 'GREETING',
        context: {},
      },
      include: {
        messages: true,
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      content: message,
    },
  });

  const businessContext: BusinessContext = {
    business,
    services: business.services,
    availabilityRules: business.availabilityRules,
    faqs: business.faqs,
  };

  const conversationContext: ConversationContext = 
    (conversation.context as unknown as ConversationContext) ?? { clientPhone };

  const messageHistory: MessageHistory[] = [...conversation.messages]
    .reverse()
    .map((m) => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant',
      content: m.content,
    }));

  const result = await generateAIResponse(
    businessContext,
    conversationContext,
    messageHistory,
    message,
    business.timezone
  );

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      content: result.response,
    },
  });

  const updates: {
    state?: ConversationState;
    context?: object;
    lastActivity: Date;
    clientName?: string;
  } = {
    lastActivity: new Date(),
  };

  if (result.newState) {
    updates.state = result.newState;
  }

  if (result.updatedContext) {
    updates.context = result.updatedContext;
    if (result.updatedContext.clientName) {
      updates.clientName = result.updatedContext.clientName;
    }
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: updates,
  });

  return result;
}

interface AIResponseResult extends ProcessMessageResult {
  updatedContext?: ConversationContext;
}

async function generateAIResponse(
  businessContext: BusinessContext,
  conversationContext: ConversationContext,
  messageHistory: MessageHistory[],
  currentMessage: string,
  timezone: string
): Promise<AIResponseResult> {
  const systemPrompt = buildSystemPrompt(businessContext);
  const contextPrompt = buildUserContextPrompt(conversationContext);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (contextPrompt) {
    messages.push({
      role: 'system',
      content: `CURRENT CONVERSATION CONTEXT:\n${contextPrompt}`,
    });
  }

  const { summary, recent } = trimConversationHistory(messageHistory, OPENAI_LIMITS.historyWindow);
  if (summary) {
    messages.push({
      role: 'system',
      content: summary,
    });
  }
  const conversationMessages = buildConversationPrompt(recent, currentMessage);
  conversationMessages.forEach((m) => {
    messages.push({ role: m.role, content: m.content });
  });

  let response: OpenAI.Chat.ChatCompletion;
  let updatedContext = { ...conversationContext };
  let bookingCreated = false;
  let bookingId: string | undefined;

  try {
    const openaiClient = getOpenAIClient();
    response = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL_CLIENT,
      messages,
      functions: BOOKING_FUNCTIONS,
      function_call: 'auto',
      max_tokens: OPENAI_LIMITS.smsMaxTokens,
      temperature: OPENAI_LIMITS.smsTemperature,
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      response: 'Sorry, I am having trouble right now. Please try again in a moment.',
    };
  }

  const choice = response.choices[0];

  if (choice.finish_reason === 'function_call' && choice.message.function_call) {
    const functionName = choice.message.function_call.name;
    const functionArgs = JSON.parse(choice.message.function_call.arguments);

    let functionResult: string;

    switch (functionName) {
      case 'check_availability': {
        const { service_name, date } = functionArgs;
        const service = businessContext.services.find(
          (s) => s.name.toLowerCase() === service_name.toLowerCase()
        );

        if (!service) {
          functionResult = `Service "${service_name}" not found. Available services: ${businessContext.services.map((s) => s.name).join(', ')}`;
        } else {
          let targetDate: Date;
          try {
            targetDate = parseISO(date);
          } catch {
            targetDate = parseFuzzyDate(date);
          }

          const slots = await getAvailableSlots({
            businessId: businessContext.business.id,
            date: targetDate,
            durationMinutes: service.duration,
          });

          if (slots.length === 0) {
            functionResult = `No available slots on ${format(targetDate, 'EEEE, MMMM d')}. Try another day.`;
          } else {
            const formattedSlots = slots.slice(0, 6).map((s) => ({
              start: s.start.toISOString(),
              formatted: formatSlotForDisplay(s, timezone),
            }));
            
            updatedContext.proposedSlots = formattedSlots.map((s) => ({
              start: s.start,
              end: '', 
              formatted: s.formatted,
            }));
            updatedContext.requestedService = service.name;

            functionResult = `Available times on ${format(targetDate, 'EEEE, MMMM d')}: ${formattedSlots.map((s) => s.formatted).join(', ')}`;
          }
        }
        break;
      }

      case 'create_booking': {
        const { service_name, client_name, start_time } = functionArgs;
        const service = businessContext.services.find(
          (s) => s.name.toLowerCase() === service_name.toLowerCase()
        );

        if (!service) {
          functionResult = `Service not found: ${service_name}`;
        } else {
          const startTime = parseISO(start_time);
          
          const bookingResult = await createBooking({
            businessId: businessContext.business.id,
            serviceId: service.id,
            clientName: client_name,
            clientPhone: conversationContext.clientPhone,
            startTime,
            createdByAi: true,
            requireYesConfirm: true,
          });

          if (bookingResult.success && bookingResult.booking) {
            bookingCreated = true;
            bookingId = bookingResult.booking.id;
            updatedContext.clientName = client_name;
            
            if (bookingResult.depositRequired && bookingResult.depositUrl) {
              const depositDollars = (bookingResult.depositAmount || 0) / 100;
              const business = businessContext.business as { depositHoldMinutes?: number; depositPolicyText?: string };
              const holdMinutes = business.depositHoldMinutes || 30;
              const policyText = business.depositPolicyText || 'The deposit is non-refundable on no-show and will be applied toward your service.';
              
              functionResult = `Slot held for ${service.name} on ${format(startTime, 'EEEE, MMMM d')} at ${format(startTime, 'h:mm a')} for ${client_name}. A $${depositDollars.toFixed(0)} deposit is required to confirm. Please pay within ${holdMinutes} minutes: ${bookingResult.depositUrl} ${policyText}`;
            } else {
              functionResult = `Slot held for ${service.name} on ${format(startTime, 'EEEE, MMMM d')} at ${format(startTime, 'h:mm a')} for ${client_name}. Ask them to reply YES to confirm.`;
            }
          } else {
            functionResult = bookingResult.error || 'Failed to create booking. The time slot may no longer be available.';
          }
        }
        break;
      }

      case 'get_upcoming_booking': {
        const upcomingBooking = await findUpcomingBookingByClientPhone(
          businessContext.business.id,
          conversationContext.clientPhone
        );

        if (upcomingBooking) {
          functionResult = `Upcoming booking found: ${upcomingBooking.serviceName} on ${format(upcomingBooking.startTime, 'EEEE, MMMM d')} at ${format(upcomingBooking.startTime, 'h:mm a')}.`;
          updatedContext.pendingBooking = {
            serviceId: '',
            serviceName: upcomingBooking.serviceName,
            startTime: format(upcomingBooking.startTime, 'EEEE, MMMM d') + ' at ' + format(upcomingBooking.startTime, 'h:mm a'),
            endTime: upcomingBooking.endTime.toISOString(),
            duration: Math.round((upcomingBooking.endTime.getTime() - upcomingBooking.startTime.getTime()) / 60000),
          };
        } else {
          functionResult = 'No upcoming booking found for this phone number.';
        }
        break;
      }

      case 'cancel_booking': {
        const { reason } = functionArgs;
        const cancelResult = await cancelBookingByClientPhone(
          businessContext.business.id,
          conversationContext.clientPhone,
          reason
        );

        if (cancelResult.success && cancelResult.booking) {
          functionResult = `Booking cancelled: ${cancelResult.booking.serviceName} on ${format(cancelResult.booking.startTime, 'EEEE, MMMM d')} at ${format(cancelResult.booking.startTime, 'h:mm a')} has been cancelled.`;
          updatedContext.pendingBooking = undefined;
        } else {
          functionResult = cancelResult.error || 'Could not cancel booking. You may not have an upcoming appointment.';
        }
        break;
      }

      case 'reschedule_booking': {
        const { new_start_time } = functionArgs;
        let newStartTime: Date;
        try {
          newStartTime = parseISO(new_start_time);
        } catch {
          newStartTime = parseFuzzyDate(new_start_time);
        }

        const rescheduleResult = await rescheduleBookingByClientPhone(
          businessContext.business.id,
          conversationContext.clientPhone,
          newStartTime
        );

        if (rescheduleResult.success && rescheduleResult.booking) {
          functionResult = `Booking rescheduled! Your ${rescheduleResult.booking.serviceName} is now on ${format(rescheduleResult.booking.startTime, 'EEEE, MMMM d')} at ${format(rescheduleResult.booking.startTime, 'h:mm a')}.`;
          updatedContext.pendingBooking = undefined;
        } else {
          functionResult = rescheduleResult.error || 'Could not reschedule booking. The new time may not be available.';
        }
        break;
      }

      case 'escalate_to_owner': {
        functionResult = 'I will have the owner get back to you shortly.';
        break;
      }

      case 'join_waitlist': {
        const { service_name, preferred_date, window_start, window_end } = functionArgs;
        const { joinWaitlist } = await import('./waitlist');
        const service = service_name
          ? businessContext.services.find((s) => s.name.toLowerCase() === String(service_name).toLowerCase())
          : undefined;
        let preferredDate: Date | undefined;
        if (preferred_date) {
          try {
            preferredDate = parseISO(preferred_date);
          } catch {
            preferredDate = parseFuzzyDate(preferred_date);
          }
        }
        const entry = await joinWaitlist({
          businessId: businessContext.business.id,
          clientPhone: conversationContext.clientPhone,
          clientName: conversationContext.clientName,
          serviceId: service?.id,
          serviceName: service?.name || service_name,
          preferredDate,
          windowStart: window_start,
          windowEnd: window_end,
        });
        functionResult = `Added to the waitlist at position ${entry.position}. They will be texted if a matching slot opens.`;
        break;
      }

      default:
        functionResult = 'I am not sure how to help with that.';
    }

    messages.push({
      role: 'assistant',
      content: null,
      function_call: choice.message.function_call,
    } as OpenAI.Chat.ChatCompletionMessageParam);
    
    messages.push({
      role: 'function',
      name: functionName,
      content: functionResult,
    } as OpenAI.Chat.ChatCompletionMessageParam);

    const openaiClient = getOpenAIClient();
    const followUpResponse = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL_CLIENT,
      messages,
      max_tokens: OPENAI_LIMITS.smsMaxTokens,
      temperature: OPENAI_LIMITS.smsTemperature,
    });

    return {
      response: followUpResponse.choices[0].message.content || functionResult,
      updatedContext,
      bookingCreated,
      bookingId,
    };
  }

  return {
    response: choice.message.content || 'Sorry, I did not understand that.',
    updatedContext,
    bookingCreated,
    bookingId,
  };
}

function parseFuzzyDate(input: string): Date {
  const lower = input.toLowerCase();
  const today = startOfDay(new Date());

  if (lower === 'today') return today;
  if (lower === 'tomorrow') return addDays(today, 1);

  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = daysOfWeek.findIndex((d) => lower.includes(d));
  
  if (dayIndex !== -1) {
    const todayIndex = today.getDay();
    let daysUntil = dayIndex - todayIndex;
    if (daysUntil <= 0) daysUntil += 7;
    return addDays(today, daysUntil);
  }

  try {
    const parsed = parse(input, 'MMMM d', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  try {
    const parsed = parse(input, 'M/d', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  return today;
}
