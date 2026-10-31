import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockPrisma = {
  business: {
    findUnique: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  calendarConnection: {
    findUnique: jest.fn(),
  },
  scheduledReminder: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({ credentials: {} }),
      })),
    },
    calendar: jest.fn().mockReturnValue({
      freebusy: {
        query: jest.fn().mockResolvedValue({
          data: {
            calendars: {
              primary: { busy: [] },
            },
          },
        }),
      },
      events: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'event-123' } }),
      },
    }),
  },
}));

describe('Availability Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('getAvailableSlots', () => {
    it('should return empty array when business not found', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      const { getAvailableSlots } = await import('@/services/calendar');

      const slots = await getAvailableSlots({
        businessId: 'nonexistent',
        date: new Date('2024-01-15'),
        durationMinutes: 60,
      });

      expect(slots).toEqual([]);
    });

    it('should return empty array when no availability rules for requested day', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        timezone: 'America/New_York',
        availabilityRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            isActive: true,
          },
        ],
      });

      const { getAvailableSlots } = await import('@/services/calendar');

      const sunday = new Date('2024-01-14');
      const slots = await getAvailableSlots({
        businessId: 'business-1',
        date: sunday,
        durationMinutes: 60,
      });

      expect(slots).toEqual([]);
    });

    it('should exclude slots that conflict with existing bookings', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        timezone: 'America/New_York',
        availabilityRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '12:00',
            isActive: true,
          },
        ],
      });

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);

      mockPrisma.booking.findMany.mockResolvedValue([
        {
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
        },
      ]);

      const { getAvailableSlots } = await import('@/services/calendar');

      const monday = new Date('2024-01-15');
      const slots = await getAvailableSlots({
        businessId: 'business-1',
        date: monday,
        durationMinutes: 60,
      });

      const conflictingSlot = slots.find(
        (s) => s.start.getHours() === 10 && s.start.getMinutes() === 0
      );
      expect(conflictingSlot).toBeUndefined();
    });

    it('should generate slots at 30 minute intervals', async () => {
      const testDate = new Date('2024-01-15T12:00:00');
      const dayOfWeek = testDate.getDay();
      
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        timezone: 'UTC',
        availabilityRules: [
          {
            dayOfWeek: dayOfWeek,
            startTime: '09:00',
            endTime: '11:00',
            isActive: true,
          },
        ],
      });

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const { getAvailableSlots } = await import('@/services/calendar');

      const slots = await getAvailableSlots({
        businessId: 'business-1',
        date: testDate,
        durationMinutes: 30,
      });

      expect(slots.length).toBeGreaterThan(0);
      
      for (let i = 1; i < slots.length; i++) {
        const diff = slots[i].start.getTime() - slots[i-1].start.getTime();
        expect(diff).toBe(30 * 60 * 1000);
      }
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true when slot is available', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        timezone: 'America/New_York',
        availabilityRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            isActive: true,
          },
        ],
      });

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const { isSlotAvailable } = await import('@/services/calendar');

      const startTime = new Date('2024-01-15T10:00:00');
      const endTime = new Date('2024-01-15T11:00:00');

      const available = await isSlotAvailable('business-1', startTime, endTime);

      expect(available).toBe(true);
    });

    it('should return false when slot conflicts with booking', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-1',
        timezone: 'America/New_York',
        availabilityRules: [
          {
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            isActive: true,
          },
        ],
      });

      mockPrisma.calendarConnection.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
        },
      ]);

      const { isSlotAvailable } = await import('@/services/calendar');

      const startTime = new Date('2024-01-15T10:00:00');
      const endTime = new Date('2024-01-15T11:00:00');

      const available = await isSlotAvailable('business-1', startTime, endTime);

      expect(available).toBe(false);
    });
  });
});
