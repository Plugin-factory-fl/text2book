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
  },
  business: {
    findUnique: jest.fn(),
  },
  scheduledReminder: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  calendarConnection: {
    findUnique: jest.fn(),
  },
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

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@/services/calendar', () => mockCalendar);
jest.mock('@/services/twilio', () => mockTwilio);

describe('Booking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('createBooking', () => {
    it('should reject when service not found', async () => {
      mockPrisma.service.findUnique.mockResolvedValue(null);

      const { createBooking } = await import('@/services/booking');

      const result = await createBooking({
        businessId: 'business-1',
        serviceId: 'nonexistent',
        clientName: 'Test Client',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service not found');
    });

    it('should reject double booking when slot is not available', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        name: 'Haircut',
        duration: 60,
        price: 50,
      });

      mockCalendar.isSlotAvailable.mockResolvedValue(false);

      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'existing-booking',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
      });

      const { createBooking } = await import('@/services/booking');

      const result = await createBooking({
        businessId: 'business-1',
        serviceId: 'service-1',
        clientName: 'Test Client',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no longer available');
    });

    it('should reject when conflicting booking exists', async () => {
      mockPrisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        name: 'Haircut',
        duration: 60,
        price: 50,
      });

      mockCalendar.isSlotAvailable.mockResolvedValue(true);

      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'conflicting-booking',
        startTime: new Date('2024-01-15T10:30:00'),
        endTime: new Date('2024-01-15T11:30:00'),
      });

      const { createBooking } = await import('@/services/booking');

      const result = await createBooking({
        businessId: 'business-1',
        serviceId: 'service-1',
        clientName: 'Test Client',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conflicts');
    });

    it('should create booking successfully when no conflicts', async () => {
      const mockService = {
        id: 'service-1',
        name: 'Haircut',
        duration: 60,
        price: 50,
      };

      const mockBusiness = {
        id: 'business-1',
        reminderHoursBefore: 24,
        phoneNumber: {
          phoneNumber: '+15559876543',
        },
      };

      const mockCreatedBooking = {
        id: 'new-booking-1',
        serviceName: 'Haircut',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
      };

      mockPrisma.service.findUnique.mockResolvedValue(mockService);
      mockCalendar.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockCalendar.createCalendarEvent.mockResolvedValue('calendar-event-id');
      mockPrisma.booking.create.mockResolvedValue(mockCreatedBooking);
      mockPrisma.scheduledReminder.create.mockResolvedValue({});
      mockTwilio.sendSms.mockResolvedValue('message-sid');
      mockPrisma.booking.update.mockResolvedValue({});

      const { createBooking } = await import('@/services/booking');

      const result = await createBooking({
        businessId: 'business-1',
        serviceId: 'service-1',
        clientName: 'Test Client',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
      });

      expect(result.success).toBe(true);
      expect(result.booking?.id).toBe('new-booking-1');
      expect(mockPrisma.booking.create).toHaveBeenCalled();
      expect(mockCalendar.createCalendarEvent).toHaveBeenCalled();
      expect(mockTwilio.sendSms).toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should reject when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const { cancelBooking } = await import('@/services/booking');

      const result = await cancelBooking('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should reject when booking already cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: 'CANCELLED',
        business: { phoneNumber: null },
      });

      const { cancelBooking } = await import('@/services/booking');

      const result = await cancelBooking('booking-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking is already cancelled');
    });

    it('should cancel booking and delete calendar event', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        businessId: 'business-1',
        serviceName: 'Haircut',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
        status: 'CONFIRMED',
        calendarEventId: 'event-123',
        business: {
          phoneNumber: { phoneNumber: '+15559876543' },
        },
      });

      mockCalendar.deleteCalendarEvent.mockResolvedValue(true);
      mockPrisma.booking.update.mockResolvedValue({});
      mockPrisma.scheduledReminder.deleteMany.mockResolvedValue({ count: 1 });
      mockTwilio.sendSms.mockResolvedValue('message-sid');

      const { cancelBooking } = await import('@/services/booking');

      const result = await cancelBooking('booking-1', 'Client requested');

      expect(result.success).toBe(true);
      expect(mockCalendar.deleteCalendarEvent).toHaveBeenCalledWith('business-1', 'event-123');
      expect(mockPrisma.scheduledReminder.deleteMany).toHaveBeenCalled();
    });
  });

  describe('rescheduleBooking', () => {
    it('should reject when booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const { rescheduleBooking } = await import('@/services/booking');

      const result = await rescheduleBooking('nonexistent', new Date());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should reject when new time is not available', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        businessId: 'business-1',
        duration: 60,
        status: 'CONFIRMED',
        service: { duration: 60 },
        business: { reminderHoursBefore: 24, phoneNumber: null },
      });

      mockCalendar.isSlotAvailable.mockResolvedValue(false);

      const { rescheduleBooking } = await import('@/services/booking');

      const result = await rescheduleBooking('booking-1', new Date('2024-01-16T10:00:00'));

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should reschedule and update calendar event', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        businessId: 'business-1',
        serviceName: 'Haircut',
        clientPhone: '+15551234567',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
        duration: 60,
        status: 'CONFIRMED',
        calendarEventId: 'event-123',
        service: { duration: 60 },
        business: {
          reminderHoursBefore: 24,
          phoneNumber: { phoneNumber: '+15559876543' },
        },
      });

      mockCalendar.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockCalendar.updateCalendarEvent.mockResolvedValue(true);
      mockPrisma.booking.update.mockResolvedValue({});
      mockPrisma.scheduledReminder.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.scheduledReminder.create.mockResolvedValue({});
      mockTwilio.sendSms.mockResolvedValue('message-sid');

      const { rescheduleBooking } = await import('@/services/booking');

      const newTime = new Date('2024-01-16T14:00:00');
      const result = await rescheduleBooking('booking-1', newTime);

      expect(result.success).toBe(true);
      expect(mockCalendar.updateCalendarEvent).toHaveBeenCalledWith(
        'business-1',
        'event-123',
        expect.objectContaining({
          startTime: newTime,
        })
      );
    });
  });
});
