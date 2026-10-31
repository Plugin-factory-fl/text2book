import { describe, it, expect } from '@jest/globals';
import { buildSystemPrompt, buildUserContextPrompt, ConversationContext } from '../src/prompts/booking-assistant';
import { Business, Service, AvailabilityRule, FAQ } from '@prisma/client';

describe('Conversation Prompts', () => {
  const mockBusiness: Business = {
    id: 'business-1',
    userId: 'user-1',
    name: 'Test Hair Studio',
    category: 'Hair Salon',
    description: null,
    phone: '555-1234',
    email: null,
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    timezone: 'America/New_York',
    cancellationPolicy: '24 hours notice required',
    reminderHoursBefore: 24,
    isActive: true,
    onboardingComplete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockServices: Service[] = [
    {
      id: 'service-1',
      businessId: 'business-1',
      name: 'Haircut',
      description: 'Standard haircut',
      duration: 60,
      price: 50,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockAvailabilityRules: AvailabilityRule[] = [
    {
      id: 'rule-1',
      businessId: 'business-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockFaqs: FAQ[] = [
    {
      id: 'faq-1',
      businessId: 'business-1',
      question: 'What are your hours?',
      answer: 'Monday to Friday, 9am to 5pm',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  describe('buildSystemPrompt', () => {
    it('should include business name in prompt', () => {
      const context = {
        business: mockBusiness,
        services: mockServices,
        availabilityRules: mockAvailabilityRules,
        faqs: mockFaqs,
      };

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('Test Hair Studio');
      expect(prompt).toContain('Hair Salon');
      expect(prompt).toContain('Haircut');
      expect(prompt).toContain('60 minutes');
      expect(prompt).toContain('$50.00');
      expect(prompt).toContain('Monday');
      expect(prompt).toContain('09:00 to 17:00');
      expect(prompt).toContain('What are your hours?');
      expect(prompt).toContain('Monday to Friday, 9am to 5pm');
      expect(prompt).toContain('24 hours notice required');
    });

    it('should include behavioral rules', () => {
      const context = {
        business: { ...mockBusiness, category: null },
        services: [],
        availabilityRules: [],
        faqs: [],
      };

      const prompt = buildSystemPrompt(context);

      expect(prompt).toContain('NEVER double book');
      expect(prompt).toContain('check_availability');
      expect(prompt).toContain('SHORT and natural');
      expect(prompt).toContain('owner get back to you');
      expect(prompt).toContain('Never use dashes');
    });
  });

  describe('buildUserContextPrompt', () => {
    it('should include client information', () => {
      const context: ConversationContext = {
        clientName: 'John Doe',
        clientPhone: '+15551234567',
        requestedService: 'Haircut',
        requestedTime: 'tomorrow at 2pm',
      };

      const prompt = buildUserContextPrompt(context);

      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('+15551234567');
      expect(prompt).toContain('Haircut');
      expect(prompt).toContain('tomorrow at 2pm');
    });

    it('should include available slots when provided', () => {
      const context: ConversationContext = {
        clientPhone: '+15551234567',
      };

      const availableSlots = [
        { start: '2024-01-15T10:00:00', formatted: '10:00 AM' },
        { start: '2024-01-15T11:00:00', formatted: '11:00 AM' },
        { start: '2024-01-15T14:00:00', formatted: '2:00 PM' },
      ];

      const prompt = buildUserContextPrompt(context, availableSlots);

      expect(prompt).toContain('AVAILABLE SLOTS');
      expect(prompt).toContain('10:00 AM');
      expect(prompt).toContain('11:00 AM');
      expect(prompt).toContain('2:00 PM');
    });

    it('should include pending booking details', () => {
      const context: ConversationContext = {
        clientPhone: '+15551234567',
        pendingBooking: {
          serviceId: 'service-1',
          serviceName: 'Haircut',
          startTime: '2024-01-15T10:00:00',
          endTime: '2024-01-15T11:00:00',
          duration: 60,
          price: 50,
        },
      };

      const prompt = buildUserContextPrompt(context);

      expect(prompt).toContain('PENDING BOOKING');
      expect(prompt).toContain('Haircut');
      expect(prompt).toContain('60 minutes');
      expect(prompt).toContain('$50.00');
    });
  });
});
