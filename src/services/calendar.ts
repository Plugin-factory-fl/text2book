import { google, calendar_v3 } from 'googleapis';
import prisma from '@/lib/prisma';
import { addMinutes, parseISO, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/calendar/callback`
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getCalendarClient(businessId: string): Promise<calendar_v3.Calendar | null> {
  const connection = await prisma.calendarConnection.findUnique({
    where: { businessId },
  });

  if (!connection || !connection.accessToken) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });

  if (connection.expiresAt && new Date() >= connection.expiresAt) {
    if (!connection.refreshToken) {
      return null;
    }
    
    const newCredentials = await refreshAccessToken(connection.refreshToken);
    await prisma.calendarConnection.update({
      where: { businessId },
      data: {
        accessToken: newCredentials.access_token!,
        expiresAt: newCredentials.expiry_date ? new Date(newCredentials.expiry_date) : null,
      },
    });
    oauth2Client.setCredentials(newCredentials);
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface AvailabilityParams {
  businessId: string;
  date: Date;
  durationMinutes: number;
}

export async function getAvailableSlots({
  businessId,
  date,
  durationMinutes,
}: AvailabilityParams): Promise<TimeSlot[]> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { availabilityRules: { where: { isActive: true } } },
  });

  if (!business) return [];

  const timezone = business.timezone;
  const zonedDate = toZonedTime(date, timezone);
  const dayOfWeek = zonedDate.getDay();

  const dayRules = business.availabilityRules.filter(
    (rule) => rule.dayOfWeek === dayOfWeek
  );

  if (dayRules.length === 0) return [];

  const calendar = await getCalendarClient(businessId);
  
  const dayStart = startOfDay(zonedDate);
  const dayEnd = endOfDay(zonedDate);

  let busyTimes: Array<{ start: Date; end: Date }> = [];

  if (calendar) {
    const connection = await prisma.calendarConnection.findUnique({
      where: { businessId },
    });

    const calendarId = connection?.calendarId || 'primary';

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const calendarBusy = freeBusyResponse.data.calendars?.[calendarId]?.busy || [];
    busyTimes = calendarBusy.map((b) => ({
      start: parseISO(b.start!),
      end: parseISO(b.end!),
    }));
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      businessId,
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
  });

  existingBookings.forEach((booking) => {
    busyTimes.push({
      start: booking.startTime,
      end: booking.endTime,
    });
  });

  const availableSlots: TimeSlot[] = [];

  for (const rule of dayRules) {
    const [startHour, startMin] = rule.startTime.split(':').map(Number);
    const [endHour, endMin] = rule.endTime.split(':').map(Number);

    const ruleStart = new Date(zonedDate);
    ruleStart.setHours(startHour, startMin, 0, 0);

    const ruleEnd = new Date(zonedDate);
    ruleEnd.setHours(endHour, endMin, 0, 0);

    let currentSlotStart = ruleStart;

    while (addMinutes(currentSlotStart, durationMinutes) <= ruleEnd) {
      const slotEnd = addMinutes(currentSlotStart, durationMinutes);

      const hasConflict = busyTimes.some((busy) => {
        return (
          (currentSlotStart >= busy.start && currentSlotStart < busy.end) ||
          (slotEnd > busy.start && slotEnd <= busy.end) ||
          (currentSlotStart <= busy.start && slotEnd >= busy.end)
        );
      });

      if (!hasConflict) {
        availableSlots.push({
          start: new Date(currentSlotStart),
          end: slotEnd,
        });
      }

      currentSlotStart = addMinutes(currentSlotStart, 30);
    }
  }

  return availableSlots;
}

export async function isSlotAvailable(
  businessId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const slots = await getAvailableSlots({
    businessId,
    date: startTime,
    durationMinutes: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
  });

  return slots.some(
    (slot) =>
      slot.start.getTime() === startTime.getTime() &&
      slot.end.getTime() === endTime.getTime()
  );
}

export interface CreateEventParams {
  businessId: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail?: string;
}

export async function createCalendarEvent({
  businessId,
  summary,
  description,
  startTime,
  endTime,
  attendeeEmail,
}: CreateEventParams): Promise<string | null> {
  const calendar = await getCalendarClient(businessId);
  if (!calendar) return null;

  const connection = await prisma.calendarConnection.findUnique({
    where: { businessId },
  });

  const calendarId = connection?.calendarId || 'primary';

  const event: calendar_v3.Schema$Event = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
    },
    end: {
      dateTime: endTime.toISOString(),
    },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  return response.data.id || null;
}

export async function updateCalendarEvent(
  businessId: string,
  eventId: string,
  updates: Partial<CreateEventParams>
): Promise<boolean> {
  const calendar = await getCalendarClient(businessId);
  if (!calendar) return false;

  const connection = await prisma.calendarConnection.findUnique({
    where: { businessId },
  });

  const calendarId = connection?.calendarId || 'primary';

  const event: calendar_v3.Schema$Event = {};
  if (updates.summary) event.summary = updates.summary;
  if (updates.description) event.description = updates.description;
  if (updates.startTime) event.start = { dateTime: updates.startTime.toISOString() };
  if (updates.endTime) event.end = { dateTime: updates.endTime.toISOString() };

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: event,
  });

  return true;
}

export async function deleteCalendarEvent(
  businessId: string,
  eventId: string
): Promise<boolean> {
  const calendar = await getCalendarClient(businessId);
  if (!calendar) return false;

  const connection = await prisma.calendarConnection.findUnique({
    where: { businessId },
  });

  const calendarId = connection?.calendarId || 'primary';

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  return true;
}

export function formatSlotForDisplay(slot: TimeSlot, timezone: string): string {
  const zonedStart = toZonedTime(slot.start, timezone);
  return format(zonedStart, 'h:mm a');
}
