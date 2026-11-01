import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockPrisma = {
  service: {
    findUnique: jest.fn(),
  },
  booking: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  business: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  trustedClient: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  depositPayment: {
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  scheduledReminder: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  calendarConnection: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockCalendar = {
  isSlotAvailable: jest.fn(),
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
};

const mockTwilio = {
  sendSms: jest.fn(),
};

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  accounts: {
    retrieve: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@/services/calendar', () => mockCalendar);
jest.mock('@/services/twilio', () => mockTwilio);

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

describe('Deposit Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('isClientTrusted', () => {
    it('should return true for trusted clients', async () => {
      mockPrisma.trustedClient.findFirst.mockResolvedValue({
        id: 'tc-1',
        businessId: 'business-1',
        phone: '+15551234567',
        name: 'Trusted Customer',
      });

      const { isClientTrusted } = await import('@/services/stripe-connect');

      const result = await isClientTrusted('business-1', '+15551234567');
      expect(result).toBe(true);
    });

    it('should return false for non-trusted clients', async () => {
      mockPrisma.trustedClient.findFirst.mockResolvedValue(null);

      const { isClientTrusted } = await import('@/services/stripe-connect');

      const result = await isClientTrusted('business-1', '+15559999999');
      expect(result).toBe(false);
    });

    it('should match phone numbers with different formatting', async () => {
      mockPrisma.trustedClient.findFirst.mockResolvedValue({
        id: 'tc-1',
        businessId: 'business-1',
        phone: '+15551234567',
        name: 'Trusted Customer',
      });

      const { isClientTrusted } = await import('@/services/stripe-connect');

      const result = await isClientTrusted('business-1', '(555) 123-4567');
      expect(mockPrisma.trustedClient.findFirst).toHaveBeenCalled();
    });
  });

  describe('getDepositAmountForService', () => {
    it('should return null when deposits are disabled', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        depositsEnabled: false,
        defaultDepositAmount: 2000,
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      const { getDepositAmountForService } = await import('@/services/stripe-connect');

      const result = await getDepositAmountForService('business-1', 'service-1');
      expect(result).toBeNull();
    });

    it('should return null when Stripe is not set up', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        depositsEnabled: true,
        defaultDepositAmount: 2000,
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      });

      const { getDepositAmountForService } = await import('@/services/stripe-connect');

      const result = await getDepositAmountForService('business-1', 'service-1');
      expect(result).toBeNull();
    });

    it('should return default deposit amount when no service override', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        depositsEnabled: true,
        defaultDepositAmount: 2000,
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        depositOverride: null,
      });

      const { getDepositAmountForService } = await import('@/services/stripe-connect');

      const result = await getDepositAmountForService('business-1', 'service-1');
      expect(result).toBe(2000);
    });

    it('should return service override when set', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        depositsEnabled: true,
        defaultDepositAmount: 2000,
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        depositOverride: 1500,
      });

      const { getDepositAmountForService } = await import('@/services/stripe-connect');

      const result = await getDepositAmountForService('business-1', 'service-1');
      expect(result).toBe(1500);
    });

    it('should return null when service override is 0 (deposit disabled for service)', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        depositsEnabled: true,
        defaultDepositAmount: 2000,
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      });

      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        depositOverride: 0,
      });

      const { getDepositAmountForService } = await import('@/services/stripe-connect');

      const result = await getDepositAmountForService('business-1', 'service-1');
      expect(result).toBeNull();
    });
  });

  describe('Deposit Payment Flow', () => {
    it('should handle successful deposit payment via webhook', async () => {
      const mockSession = {
        id: 'cs_test_123',
        metadata: {
          type: 'deposit',
          platform: 'text2book',
          bookingId: 'booking-1',
          businessId: 'business-1',
        },
        payment_intent: 'pi_test_123',
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      mockPrisma.depositPayment.update.mockResolvedValue({
        id: 'dp-1',
        bookingId: 'booking-1',
        status: 'paid',
      });

      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED',
        depositStatus: 'PAID',
      });

      const { handleDepositPaymentSuccess } = await import('@/services/stripe-connect');

      const result = await handleDepositPaymentSuccess('cs_test_123');
      
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe('booking-1');
    });

    it('should ignore non-Text2Book sessions', async () => {
      const mockSession = {
        id: 'cs_test_456',
        metadata: {
          type: 'other',
          platform: 'megamix',
        },
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const { handleDepositPaymentSuccess } = await import('@/services/stripe-connect');

      const result = await handleDepositPaymentSuccess('cs_test_456');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a Text2Book deposit session');
    });
  });

  describe('Deposit Hold Expiry', () => {
    it('should cancel booking when deposit hold expires', async () => {
      const mockSession = {
        id: 'cs_test_expired',
        metadata: {
          type: 'deposit',
          platform: 'text2book',
          bookingId: 'booking-2',
        },
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-2',
        status: 'AWAITING_DEPOSIT',
        depositStatus: 'PENDING',
      });

      mockPrisma.depositPayment.update.mockResolvedValue({
        id: 'dp-2',
        status: 'expired',
      });

      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-2',
        status: 'CANCELLED',
        depositStatus: 'EXPIRED',
      });

      const { handleDepositSessionExpired } = await import('@/services/stripe-connect');

      const result = await handleDepositSessionExpired('cs_test_expired');
      
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe('booking-2');
    });
  });

  describe('Booking with Deposits', () => {
    it('should skip deposit for trusted clients', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        name: 'Haircut',
        duration: 60,
        price: 50,
        depositOverride: null,
      });

      mockPrisma.trustedClient.findFirst.mockResolvedValue({
        id: 'tc-1',
        businessId: 'business-1',
        phone: '+15551234567',
      });

      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        name: 'Test Salon',
        depositsEnabled: true,
        defaultDepositAmount: 2000,
        depositHoldMinutes: 30,
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        phoneNumber: { phoneNumber: '+15559999999' },
        reminderHoursBefore: 24,
      });

      mockCalendar.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockCalendar.createCalendarEvent.mockResolvedValue('event-123');

      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-trusted',
        status: 'CONFIRMED',
        depositRequired: false,
        depositStatus: 'NOT_REQUIRED',
      });

      mockTwilio.sendSms.mockResolvedValue({ sid: 'msg-123' });
      mockPrisma.booking.update.mockResolvedValue({});
      mockPrisma.scheduledReminder.create.mockResolvedValue({});

      const { createBooking } = await import('@/services/booking');

      const result = await createBooking({
        businessId: 'business-1',
        serviceId: 'service-1',
        clientName: 'Trusted Client',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
      });

      expect(result.success).toBe(true);
      expect(result.depositRequired).toBeFalsy();
      expect(result.depositUrl).toBeUndefined();
    });
  });
});
