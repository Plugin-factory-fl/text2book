import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBusiness, getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, addDays } from 'date-fns';
import { sendSms } from '@/services/twilio';

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const OWNER_ASSISTANT_FUNCTIONS: OpenAI.Chat.ChatCompletionCreateParams.Function[] = [
  {
    name: 'get_bookings',
    description: 'Get bookings for a date range or specific criteria',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Specific date (YYYY-MM-DD) or relative like "today", "tomorrow", "friday"' },
        start_date: { type: 'string', description: 'Start of date range (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End of date range (YYYY-MM-DD)' },
        status: { type: 'string', enum: ['CONFIRMED', 'AWAITING_DEPOSIT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
        client_phone: { type: 'string', description: 'Filter by client phone' },
      },
    },
  },
  {
    name: 'get_revenue',
    description: 'Get revenue statistics for a time period',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'last_month', 'all_time'] },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_client_info',
    description: 'Get detailed information about a specific client',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Client phone number' },
        name: { type: 'string', description: 'Client name to search' },
      },
    },
  },
  {
    name: 'create_booking',
    description: 'Create a new booking for a client. Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        client_phone: { type: 'string' },
        client_name: { type: 'string' },
        service_name: { type: 'string' },
        start_time: { type: 'string', description: 'ISO datetime string' },
        notes: { type: 'string' },
      },
      required: ['client_phone', 'client_name', 'service_name', 'start_time'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an existing booking. Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string' },
        reason: { type: 'string' },
        notify_client: { type: 'boolean', default: true },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Reschedule an existing booking to a new time. Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string' },
        new_start_time: { type: 'string', description: 'New ISO datetime' },
        notify_client: { type: 'boolean', default: true },
      },
      required: ['booking_id', 'new_start_time'],
    },
  },
  {
    name: 'send_message_to_client',
    description: 'Send an SMS message to a client. Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        client_phone: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['client_phone', 'message'],
    },
  },
  {
    name: 'add_trusted_client',
    description: 'Add a client to the trusted list (exempt from deposits)',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        name: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'remove_trusted_client',
    description: 'Remove a client from the trusted list',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'update_settings',
    description: 'Update business settings like deposit amount, policy, etc.',
    parameters: {
      type: 'object',
      properties: {
        deposits_enabled: { type: 'boolean' },
        default_deposit_amount: { type: 'number', description: 'In dollars' },
        deposit_hold_minutes: { type: 'number' },
        deposit_policy_text: { type: 'string' },
        reminder_hours_before: { type: 'number' },
      },
    },
  },
  {
    name: 'get_settings',
    description: 'Get current business settings',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mark_deposit_paid',
    description: 'Manually mark a deposit as paid for a booking',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string' },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'send_deposit_reminder',
    description: 'Send a deposit payment reminder to a client',
    parameters: {
      type: 'object',
      properties: {
        booking_id: { type: 'string' },
      },
      required: ['booking_id'],
    },
  },
];

async function executeFunctionCall(
  businessId: string,
  functionName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (functionName) {
      case 'get_bookings': {
        let whereClause: Record<string, unknown> = { businessId };
        
        if (args.status) {
          whereClause.status = args.status;
        }
        
        if (args.client_phone) {
          whereClause.clientPhone = { contains: String(args.client_phone).replace(/\D/g, '') };
        }

        if (args.date) {
          const targetDate = parseFuzzyDate(String(args.date));
          whereClause.startTime = {
            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            lt: new Date(targetDate.setHours(23, 59, 59, 999)),
          };
        } else if (args.start_date && args.end_date) {
          whereClause.startTime = {
            gte: parseISO(String(args.start_date)),
            lte: parseISO(String(args.end_date)),
          };
        }

        const bookings = await prisma.booking.findMany({
          where: whereClause,
          orderBy: { startTime: 'asc' },
          take: 20,
        });

        if (bookings.length === 0) {
          return 'No bookings found matching your criteria.';
        }

        return bookings.map(b => 
          `${b.clientName}: ${b.serviceName} on ${format(b.startTime, 'EEE MMM d')} at ${format(b.startTime, 'h:mm a')} (${b.status}${b.depositStatus !== 'NOT_REQUIRED' ? `, deposit: ${b.depositStatus}` : ''})`
        ).join('\n');
      }

      case 'get_revenue': {
        let startDate: Date;
        let endDate: Date = new Date();

        switch (args.period) {
          case 'today':
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'this_week':
            startDate = startOfWeek(new Date());
            endDate = endOfWeek(new Date());
            break;
          case 'this_month':
            startDate = startOfMonth(new Date());
            endDate = endOfMonth(new Date());
            break;
          case 'last_month':
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            startDate = startOfMonth(lastMonth);
            endDate = endOfMonth(lastMonth);
            break;
          default:
            startDate = new Date(0);
        }

        const completedBookings = await prisma.booking.findMany({
          where: {
            businessId,
            status: 'COMPLETED',
            startTime: { gte: startDate, lte: endDate },
          },
        });

        const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
        const depositsPaid = completedBookings.filter(b => b.depositStatus === 'PAID').length;

        return `Revenue for ${args.period}: $${totalRevenue.toFixed(2)} from ${completedBookings.length} completed bookings. ${depositsPaid} had deposits paid.`;
      }

      case 'get_client_info': {
        let client;
        
        if (args.phone) {
          const normalizedPhone = String(args.phone).replace(/\D/g, '');
          client = await prisma.conversation.findFirst({
            where: {
              businessId,
              clientPhone: { contains: normalizedPhone.slice(-10) },
            },
            include: {
              bookings: { orderBy: { startTime: 'desc' } },
            },
          });
        } else if (args.name) {
          client = await prisma.conversation.findFirst({
            where: {
              businessId,
              clientName: { contains: String(args.name), mode: 'insensitive' },
            },
            include: {
              bookings: { orderBy: { startTime: 'desc' } },
            },
          });
        }

        if (!client) {
          return 'Client not found.';
        }

        const totalSpent = client.bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + (b.price || 0), 0);
        const visits = client.bookings.filter(b => b.status === 'COMPLETED').length;
        const noShows = client.bookings.filter(b => b.status === 'NO_SHOW').length;
        const upcomingBooking = client.bookings.find(b => b.status === 'CONFIRMED' && b.startTime > new Date());

        const trusted = await prisma.trustedClient.findFirst({
          where: { businessId, phone: { contains: client.clientPhone.slice(-10) } },
        });

        return `Client: ${client.clientName || 'Unknown'}\nPhone: ${client.clientPhone}\nTotal visits: ${visits}\nLifetime revenue: $${totalSpent.toFixed(2)}\nNo-shows: ${noShows}\nTrusted: ${trusted ? 'Yes' : 'No'}\n${upcomingBooking ? `Next appointment: ${format(upcomingBooking.startTime, 'EEE MMM d')} at ${format(upcomingBooking.startTime, 'h:mm a')}` : 'No upcoming appointments'}`;
      }

      case 'create_booking': {
        return `CONFIRMATION REQUIRED: Create booking for ${args.client_name} (${args.client_phone}) - ${args.service_name} at ${args.start_time}. Reply "confirm" to proceed.`;
      }

      case 'cancel_booking': {
        const booking = await prisma.booking.findFirst({
          where: { id: String(args.booking_id), businessId },
        });
        if (!booking) return 'Booking not found.';
        return `CONFIRMATION REQUIRED: Cancel ${booking.clientName}'s ${booking.serviceName} on ${format(booking.startTime, 'EEE MMM d')} at ${format(booking.startTime, 'h:mm a')}. Reply "confirm" to proceed.`;
      }

      case 'reschedule_booking': {
        const booking = await prisma.booking.findFirst({
          where: { id: String(args.booking_id), businessId },
        });
        if (!booking) return 'Booking not found.';
        return `CONFIRMATION REQUIRED: Reschedule ${booking.clientName}'s ${booking.serviceName} from ${format(booking.startTime, 'EEE MMM d h:mm a')} to ${args.new_start_time}. Reply "confirm" to proceed.`;
      }

      case 'send_message_to_client': {
        return `CONFIRMATION REQUIRED: Send message to ${args.client_phone}: "${args.message}". Reply "confirm" to send.`;
      }

      case 'add_trusted_client': {
        const phone = String(args.phone).replace(/\D/g, '');
        const formattedPhone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;
        
        await prisma.trustedClient.upsert({
          where: { businessId_phone: { businessId, phone: formattedPhone } },
          update: { name: args.name as string || null, notes: args.notes as string || null },
          create: { businessId, phone: formattedPhone, name: args.name as string || null, notes: args.notes as string || null },
        });

        return `Added ${args.name || formattedPhone} to trusted clients. They will be exempt from deposits.`;
      }

      case 'remove_trusted_client': {
        const phone = String(args.phone).replace(/\D/g, '');
        await prisma.trustedClient.deleteMany({
          where: { businessId, phone: { contains: phone.slice(-10) } },
        });
        return `Removed client from trusted list.`;
      }

      case 'update_settings': {
        const updates: Record<string, unknown> = {};
        if (args.deposits_enabled !== undefined) updates.depositsEnabled = args.deposits_enabled;
        if (args.default_deposit_amount !== undefined) updates.defaultDepositAmount = Math.round(Number(args.default_deposit_amount) * 100);
        if (args.deposit_hold_minutes !== undefined) updates.depositHoldMinutes = args.deposit_hold_minutes;
        if (args.deposit_policy_text !== undefined) updates.depositPolicyText = args.deposit_policy_text;
        if (args.reminder_hours_before !== undefined) updates.reminderHoursBefore = args.reminder_hours_before;

        await prisma.business.update({ where: { id: businessId }, data: updates });
        return 'Settings updated successfully.';
      }

      case 'get_settings': {
        const business = await prisma.business.findUnique({ where: { id: businessId } });
        if (!business) return 'Business not found.';
        return `Deposits: ${business.depositsEnabled ? 'Enabled' : 'Disabled'}\nDefault deposit: $${((business.defaultDepositAmount || 0) / 100).toFixed(0)}\nHold time: ${business.depositHoldMinutes} minutes\nReminder: ${business.reminderHoursBefore} hours before`;
      }

      case 'mark_deposit_paid': {
        const booking = await prisma.booking.findFirst({
          where: { id: String(args.booking_id), businessId },
        });
        if (!booking) return 'Booking not found.';

        await prisma.booking.update({
          where: { id: booking.id },
          data: { depositStatus: 'PAID', depositPaidAt: new Date(), status: 'CONFIRMED' },
        });

        return `Marked deposit as paid for ${booking.clientName}'s ${booking.serviceName} booking.`;
      }

      case 'send_deposit_reminder': {
        const booking = await prisma.booking.findFirst({
          where: { id: String(args.booking_id), businessId },
          include: { business: { include: { phoneNumber: true } } },
        });
        if (!booking) return 'Booking not found.';
        if (booking.depositStatus !== 'PENDING') return 'No pending deposit for this booking.';

        if (booking.business.phoneNumber) {
          await sendSms({
            to: booking.clientPhone,
            from: booking.business.phoneNumber.phoneNumber,
            body: `Reminder: Please complete your $${((booking.depositAmount || 0) / 100).toFixed(0)} deposit to confirm your ${booking.serviceName} appointment.`,
          });
          return `Sent deposit reminder to ${booking.clientName}.`;
        }
        return 'Could not send reminder - no phone number configured.';
      }

      default:
        return `Unknown function: ${functionName}`;
    }
  } catch (error) {
    console.error(`Function ${functionName} error:`, error);
    return `Error executing ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function parseFuzzyDate(input: string): Date {
  const lower = input.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower === 'today') return today;
  if (lower === 'tomorrow') return addDays(today, 1);

  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = daysOfWeek.findIndex(d => lower.includes(d));
  
  if (dayIndex !== -1) {
    const todayIndex = today.getDay();
    let daysUntil = dayIndex - todayIndex;
    if (daysUntil <= 0) daysUntil += 7;
    return addDays(today, daysUntil);
  }

  try {
    return parseISO(input);
  } catch {
    return today;
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    const user = await getCurrentUser();
    
    if (!business || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationHistory = [], clientContext } = await request.json();

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ 
        response: "I'm currently unavailable. Please try again later or use the manual controls.",
        error: true 
      });
    }

    const systemPrompt = `You are an AI assistant helping ${user.name || 'the owner'} manage their business "${business.name}". 

You can help with:
- Viewing and managing bookings (create, cancel, reschedule)
- Checking revenue and statistics
- Managing client information
- Sending messages to clients
- Managing trusted clients (deposit exemptions)
- Updating business settings

${clientContext ? `Currently viewing client: ${clientContext.name || clientContext.phone}` : ''}

Always be helpful and concise. For destructive actions (canceling bookings, sending messages), ask for confirmation first. Format responses clearly.

Current date/time: ${format(new Date(), 'EEEE, MMMM d, yyyy h:mm a')}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      functions: OWNER_ASSISTANT_FUNCTIONS,
      function_call: 'auto',
      max_tokens: 500,
      temperature: 0.7,
    });

    const choice = response.choices[0];
    
    if (choice.finish_reason === 'function_call' && choice.message.function_call) {
      const functionName = choice.message.function_call.name;
      const functionArgs = JSON.parse(choice.message.function_call.arguments);
      
      const functionResult = await executeFunctionCall(business.id, functionName, functionArgs);

      const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...messages,
        {
          role: 'assistant',
          content: null,
          function_call: choice.message.function_call,
        } as OpenAI.Chat.ChatCompletionMessageParam,
        {
          role: 'function',
          name: functionName,
          content: functionResult,
        } as OpenAI.Chat.ChatCompletionMessageParam,
      ];

      const followUpResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: followUpMessages,
        max_tokens: 300,
        temperature: 0.7,
      });

      return NextResponse.json({
        response: followUpResponse.choices[0].message.content,
        functionCalled: functionName,
        functionResult,
      });
    }

    return NextResponse.json({
      response: choice.message.content,
    });
  } catch (error) {
    console.error('Assistant error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', response: 'Sorry, I encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}
