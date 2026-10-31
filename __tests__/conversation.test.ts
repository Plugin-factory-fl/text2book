import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockPrisma = {
  business: {
    findUnique: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
  },
  service: {
    findUnique: jest.fn(),
  },
  booking: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  scheduledReminder: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  calendarConnection: {
    findUnique: jest.fn(),
  },
};

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockOpenAI),
}));

jest.mock('@/services/calendar', () => ({
  getAvailableSlots: jest.fn().mockResolvedValue([
    { start: new Date('2024-01-15T10:00:00'), end: new Date('2024-01-15T11:00:00') },
    { start: new Date('2024-01-15T11:00:00'), end: new Date('2024-01-15T12:00:00') },
  ]),
  formatSlotForDisplay: jest.fn().mockReturnValue('10:00 AM'),
  isSlotAvailable: jest.fn().mockResolvedValue(true),
  createCalendarEvent: jest.fn().mockResolvedValue('event-123'),
  updateCalendarEvent: jest.fn().mockResolvedValue(true),
  deleteCalendarEvent: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/services/twilio', () => ({
  sendSms: jest.fn().mockResolvedValue('message-sid'),
}));

describe('AI Conversation Integration', () => {
  const mockBusiness = {
    id: 'business-1',
    userId: 'user-1',
    name: 'Test Salon',
    category: 'Hair Salon',
    timezone: 'America/New_York',
    reminderHoursBefore: 24,
    services: [
      { id: 'service-1', name: 'Haircut', duration: 60, price: 50, isActive: true },
    ],
    availabilityRules: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
    ],
    faqs: [],
    phoneNumber: { phoneNumber: '+15559876543' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.OPENAI_API_KEY;
  });

  describe('processIncomingMessage', () => {
    it('should return error when business not found', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      const { processIncomingMessage } = await import('@/services/ai-conversation');

      const result = await processIncomingMessage(
        'nonexistent',
        '+15551234567',
        'Hi, I want to book'
      );

      expect(result.response).toBe('Sorry, this business is not available.');
    });

    it('should create new conversation for new client', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockPrisma.conversation.findUnique.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue({
        id: 'conv-1',
        businessId: 'business-1',
        clientPhone: '+15551234567',
        state: 'GREETING',
        context: {},
        messages: [],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockPrisma.conversation.update.mockResolvedValue({});

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          finish_reason: 'stop',
          message: {
            content: 'Hi! Welcome to Test Salon. How can I help you today?',
          },
        }],
      });

      const { processIncomingMessage } = await import('@/services/ai-conversation');

      const result = await processIncomingMessage(
        'business-1',
        '+15551234567',
        'Hi'
      );

      expect(mockPrisma.conversation.create).toHaveBeenCalled();
      expect(result.response).toContain('Welcome');
    });

    it('should handle booking flow with function calls', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        businessId: 'business-1',
        clientPhone: '+15551234567',
        state: 'COLLECTING_SERVICE',
        context: { clientPhone: '+15551234567' },
        messages: [
          { direction: 'INBOUND', content: 'I want a haircut' },
          { direction: 'OUTBOUND', content: 'Great! When would you like to come in?' },
        ],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockPrisma.conversation.update.mockResolvedValue({});
      mockPrisma.service.findUnique.mockResolvedValue(mockBusiness.services[0]);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        serviceName: 'Haircut',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
      });
      mockPrisma.booking.update.mockResolvedValue({});
      mockPrisma.scheduledReminder.create.mockResolvedValue({});

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'function_call',
            message: {
              function_call: {
                name: 'create_booking',
                arguments: JSON.stringify({
                  service_name: 'Haircut',
                  client_name: 'John Doe',
                  start_time: '2024-01-15T10:00:00',
                }),
              },
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: 'Your haircut is confirmed for Monday at 10:00 AM!',
            },
          }],
        });

      const { processIncomingMessage } = await import('@/services/ai-conversation');

      const result = await processIncomingMessage(
        'business-1',
        '+15551234567',
        'Book me for Monday at 10am, name is John Doe'
      );

      expect(result.response).toContain('confirmed');
      expect(result.bookingCreated).toBe(true);
    });

    it('should handle availability check function call', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        businessId: 'business-1',
        clientPhone: '+15551234567',
        state: 'GREETING',
        context: { clientPhone: '+15551234567' },
        messages: [],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockPrisma.conversation.update.mockResolvedValue({});

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'function_call',
            message: {
              function_call: {
                name: 'check_availability',
                arguments: JSON.stringify({
                  service_name: 'Haircut',
                  date: '2024-01-15',
                }),
              },
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: 'I have openings at 10:00 AM, 11:00 AM, and 2:00 PM. Which works best?',
            },
          }],
        });

      const { processIncomingMessage } = await import('@/services/ai-conversation');

      const result = await processIncomingMessage(
        'business-1',
        '+15551234567',
        'When can I get a haircut on Monday?'
      );

      expect(result.response).toContain('openings');
    });

    it('should handle cancellation request', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        businessId: 'business-1',
        clientPhone: '+15551234567',
        state: 'GREETING',
        context: { clientPhone: '+15551234567' },
        messages: [],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockPrisma.conversation.update.mockResolvedValue({});

      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        businessId: 'business-1',
        serviceName: 'Haircut',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
        status: 'CONFIRMED',
        calendarEventId: 'event-123',
        business: {
          phoneNumber: { phoneNumber: '+15559876543' },
        },
      });

      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        businessId: 'business-1',
        serviceName: 'Haircut',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
        status: 'CONFIRMED',
        calendarEventId: 'event-123',
        business: {
          phoneNumber: { phoneNumber: '+15559876543' },
        },
      });

      mockPrisma.booking.update.mockResolvedValue({});
      mockPrisma.scheduledReminder.deleteMany.mockResolvedValue({ count: 1 });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'function_call',
            message: {
              function_call: {
                name: 'cancel_booking',
                arguments: JSON.stringify({
                  reason: 'Client requested',
                }),
              },
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: 'Your haircut appointment has been cancelled. Let me know if you want to rebook!',
            },
          }],
        });

      const { processIncomingMessage } = await import('@/services/ai-conversation');

      const result = await processIncomingMessage(
        'business-1',
        '+15551234567',
        'I need to cancel my appointment'
      );

      expect(result.response).toContain('cancelled');
    });
  });
});
