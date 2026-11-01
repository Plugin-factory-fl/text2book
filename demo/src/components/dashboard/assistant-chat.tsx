'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { mockBookings, mockBusiness } from '@/data/mock-data';
import { ChiefAvatar } from './chief-avatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pending?: boolean;
}

interface ClientContext {
  phone: string;
  name?: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
  depositOverride: number | null;
}

interface AssistantChatProps {
  clientContext?: ClientContext | null;
  onActionComplete?: () => void;
  onServiceUpdate?: (serviceId: string, updates: { name?: string; price?: number; duration?: number }) => void;
  services?: Service[];
}

const SUGGESTED_PROMPTS = [
  "What's my revenue this month?",
  "Who's booked for tomorrow?",
  "Show unpaid deposits",
  "Import my info from mysite.com",
];

const CLIENT_CONTEXT_PROMPTS = [
  "Show their booking history",
  "Send a reminder",
  "Mark deposit paid",
  "Add to trusted clients",
];

function getMockResponse(
  query: string,
  clientContext?: ClientContext | null,
  onServiceUpdate?: (serviceId: string, updates: { name?: string; price?: number; duration?: number }) => void,
  services?: Service[]
): { response: string; action?: () => void } {
  const serviceList = services || [];
  const lowerQuery = query.toLowerCase();

  if (clientContext) {
    if (lowerQuery.includes('history') || lowerQuery.includes('booking')) {
      const bookings = mockBookings.filter(
        (b) => b.clientPhone === clientContext.phone
      );
      if (bookings.length === 0) {
        return { response: `${clientContext.name || 'This client'} has no booking history yet.` };
      }
      return {
        response: `${clientContext.name || 'This client'} has ${bookings.length} booking(s):\n\n${bookings
          .map(
            (b) =>
              `• ${b.serviceName} on ${format(new Date(b.startTime), 'MMM d')} at ${format(
                new Date(b.startTime),
                'h:mm a'
              )} (${b.status})`
          )
          .join('\n')}`,
      };
    }
    if (lowerQuery.includes('reminder')) {
      return { response: `I've sent a reminder to ${clientContext.name || clientContext.phone} about their upcoming appointment.` };
    }
    if (lowerQuery.includes('deposit') && lowerQuery.includes('paid')) {
      return { response: `Done! I've marked the deposit as paid for ${clientContext.name || clientContext.phone}.` };
    }
    if (lowerQuery.includes('trusted')) {
      return { response: `${clientContext.name || clientContext.phone} has been added to your trusted clients list. They will be exempt from deposit requirements.` };
    }
  }

  // Handle service price changes
  const priceMatch = lowerQuery.match(/(?:change|set|update)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:price\s+)?to\s+\$?(\d+)/i);
  if (priceMatch && onServiceUpdate && serviceList.length > 0) {
    const serviceName = priceMatch[1].toLowerCase();
    const newPrice = parseInt(priceMatch[2], 10);
    const service = serviceList.find((s) => s.name.toLowerCase().includes(serviceName));
    if (service) {
      return {
        response: `Done! I've updated the ${service.name} price from $${service.price} to $${newPrice}. The Services tab now reflects this change.`,
        action: () => onServiceUpdate(service.id, { price: newPrice }),
      };
    }
  }

  // Handle service duration changes
  const durationMatch = lowerQuery.match(/(?:change|set|update)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:duration\s+)?to\s+(\d+)\s*(?:min|minutes?)?/i);
  if (durationMatch && onServiceUpdate && serviceList.length > 0) {
    const serviceName = durationMatch[1].toLowerCase();
    const newDuration = parseInt(durationMatch[2], 10);
    const service = serviceList.find((s) => s.name.toLowerCase().includes(serviceName));
    if (service) {
      return {
        response: `Done! I've updated the ${service.name} duration from ${service.duration} minutes to ${newDuration} minutes. The Services tab now reflects this change.`,
        action: () => onServiceUpdate(service.id, { duration: newDuration }),
      };
    }
  }

  if (lowerQuery.includes('import') && (lowerQuery.includes('http') || lowerQuery.includes('.com') || lowerQuery.includes('site'))) {
    return {
      response: `I can import your business details from a website or document. Open the Business Info tab and use Auto-fill with AI to review the extracted name, address, hours, services, policies, and FAQs before anything is saved.`,
    };
  }

  if (lowerQuery.includes('revenue')) {
    const completedBookings = mockBookings.filter((b) => b.status === 'COMPLETED');
    const revenue = completedBookings.reduce((sum, b) => sum + b.price, 0);
    return {
      response: `Your revenue this month is $${revenue} from ${completedBookings.length} completed bookings. ${
        completedBookings.filter((b) => b.depositStatus === 'PAID').length
      } clients paid deposits.`,
    };
  }

  if (lowerQuery.includes('tomorrow') || lowerQuery.includes('booked')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const nextDay = new Date(tomorrow);
    nextDay.setDate(nextDay.getDate() + 1);

    const tomorrowBookings = mockBookings.filter((b) => {
      const bookingDate = new Date(b.startTime);
      return bookingDate >= tomorrow && bookingDate < nextDay && b.status === 'CONFIRMED';
    });

    if (tomorrowBookings.length === 0) {
      return { response: "You don't have any bookings scheduled for tomorrow." };
    }

    return {
      response: `Tomorrow's bookings:\n\n${tomorrowBookings
        .map(
          (b) =>
            `• ${b.clientName}: ${b.serviceName} at ${format(new Date(b.startTime), 'h:mm a')}`
        )
        .join('\n')}`,
    };
  }

  if (lowerQuery.includes('unpaid') || lowerQuery.includes('pending deposit')) {
    const pendingDeposits = mockBookings.filter(
      (b) => b.depositStatus === 'PENDING'
    );
    if (pendingDeposits.length === 0) {
      return { response: 'Great news! All pending deposits have been paid.' };
    }
    return {
      response: `${pendingDeposits.length} booking(s) have unpaid deposits:\n\n${pendingDeposits
        .map(
          (b) =>
            `• ${b.clientName}: ${b.serviceName} on ${format(
              new Date(b.startTime),
              'MMM d'
            )} ($${(b.depositAmount || 0) / 100} due)`
        )
        .join('\n')}\n\nWould you like me to send payment reminders?`,
    };
  }

  if (lowerQuery.includes('trusted') && lowerQuery.includes('add')) {
    return { response: `To add a trusted client, please provide their phone number and name. Trusted clients are exempt from deposit requirements.` };
  }

  if (lowerQuery.includes('settings')) {
    return {
      response: `Current settings:\n• Deposits: ${mockBusiness.depositsEnabled ? 'Enabled' : 'Disabled'}\n• Default deposit: $${(mockBusiness.defaultDepositAmount || 0) / 100}\n• Hold time: ${mockBusiness.depositHoldMinutes} minutes\n• Reminder: ${mockBusiness.reminderHoursBefore || 24} hours before`,
    };
  }

  if (lowerQuery.includes('help') || lowerQuery.includes('can you')) {
    return {
      response: `I can help you with:\n\n• Viewing and managing bookings\n• Checking revenue and statistics\n• Managing client information\n• Sending messages to clients\n• Managing trusted clients (deposit exemptions)\n• Updating business settings\n\nWhat would you like to do?`,
    };
  }

  if (lowerQuery.includes('cancel')) {
    return { response: `CONFIRMATION REQUIRED: Please specify which booking you'd like to cancel. You can say something like "cancel Emily's appointment" or "cancel the 2pm booking".` };
  }

  if (lowerQuery.includes('reschedule')) {
    return { response: `CONFIRMATION REQUIRED: Please specify which booking you'd like to reschedule and the new time. For example: "reschedule Emily's appointment to Friday at 3pm".` };
  }

  return {
    response: `I understand you're asking about "${query}". In the full version, I can help you manage bookings, check revenue, send messages, and more. Try asking:\n\n• "What's my revenue this month?"\n• "Who's booked for tomorrow?"\n• "Show unpaid deposits"`,
  };
}

export function AssistantChat({ clientContext, onActionComplete, onServiceUpdate, services }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your assistant. I can help you manage bookings, check revenue, send messages to clients, update settings, and more. What would you like to do?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (clientContext) {
      setMessages((prev) => [
        ...prev,
        {
          id: `context-${Date.now()}`,
          role: 'assistant',
          content: `Now viewing ${clientContext.name || clientContext.phone}. How can I help with this client?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [clientContext?.phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userQuery = input.trim();
    setInput('');
    setIsLoading(true);

    const pendingMessage: Message = {
      id: `pending-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, pendingMessage]);

    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

    const result = getMockResponse(userQuery, clientContext, onServiceUpdate, services);

    if (result.action) {
      result.action();
    }

    setMessages((prev) =>
      prev
        .filter((m) => !m.pending)
        .concat({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
        })
    );

    setIsLoading(false);
    inputRef.current?.focus();

    if (onActionComplete && (userQuery.includes('paid') || userQuery.includes('trusted') || result.action)) {
      onActionComplete();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const prompts = clientContext ? CLIENT_CONTEXT_PROMPTS : SUGGESTED_PROMPTS;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <ChiefAvatar size="sm" showBadge={false} className="flex-shrink-0 mt-1" />
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              )}
            >
              {message.pending ? (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        {messages.length <= 2 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              clientContext
                ? `Ask about ${clientContext.name || 'this client'}...`
                : 'Ask me anything...'
            }
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
