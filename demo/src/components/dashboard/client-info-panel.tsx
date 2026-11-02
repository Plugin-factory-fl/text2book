'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  duration: number;
  price: number;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  depositRequired?: boolean;
  depositAmount?: number | null;
  depositStatus?: string;
  paymentStatus?: string;
  remainderAmount?: number | null;
}

interface ClientStats {
  totalVisits: number;
  lifetimeRevenue: number;
  noShows: number;
  cancellations: number;
  lastVisit?: string | null;
  averageSpend: number;
}

interface ClientInfoPanelProps {
  clientPhone: string;
  clientName: string | null;
  clientEmail?: string | null;
  nextBooking?: Booking | null;
  currentBooking?: Booking | null;
  stats: ClientStats;
  isTrusted: boolean;
  onToggleTrusted: () => void;
  onReschedule?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onSendReminder?: (bookingId: string) => void;
  onRequestDeposit?: (bookingId: string) => void;
  notes?: string | null;
  calendarSynced?: boolean;
  outstandingCents?: number;
  auditLogs?: Array<{ id: string; summary: string; createdAt: string }>;
  waitlistEntries?: Array<{ id: string; serviceName?: string | null; status: string }>;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-green-100 text-green-700';
    case 'AWAITING_DEPOSIT':
      return 'bg-yellow-100 text-yellow-700';
    case 'COMPLETED':
      return 'bg-blue-100 text-blue-700';
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';
    case 'NO_SHOW':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getDepositStatusColor(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-700';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700';
    case 'EXPIRED':
      return 'bg-red-100 text-red-700';
    case 'REFUNDED':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function BookingCard({
  booking,
  label,
  onReschedule,
  onCancel,
  onSendReminder,
  onRequestDeposit,
}: {
  booking: Booking;
  label: string;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSendReminder?: (id: string) => void;
  onRequestDeposit?: (id: string) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(booking.status))}>
          {booking.status.replace('_', ' ')}
        </span>
      </div>
      <div>
        <p className="font-medium text-gray-900">{booking.serviceName}</p>
        <p className="text-sm text-gray-600">
          {format(new Date(booking.startTime), 'EEE, MMM d')} at{' '}
          {format(new Date(booking.startTime), 'h:mm a')}
        </p>
        <p className="text-sm text-gray-500">
          {booking.duration} min · ${booking.price}
        </p>
      </div>

      {booking.depositRequired && booking.depositStatus && booking.depositStatus !== 'NOT_REQUIRED' && (
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', getDepositStatusColor(booking.depositStatus))}>
            Deposit: {booking.depositStatus === 'PAID' ? '💵✅' : '💵⏳'} $
            {((booking.depositAmount || 0) / 100).toFixed(0)}
          </span>
        </div>
      )}

      {booking.notes && (
        <p className="text-xs text-gray-500 italic">Note: {booking.notes}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {booking.status === 'CONFIRMED' && onReschedule && (
          <button
            onClick={() => onReschedule(booking.id)}
            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Reschedule
          </button>
        )}
        {booking.status === 'CONFIRMED' && onCancel && (
          <button
            onClick={() => onCancel(booking.id)}
            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-red-600"
          >
            Cancel
          </button>
        )}
        {booking.status === 'CONFIRMED' && onSendReminder && (
          <button
            onClick={() => onSendReminder(booking.id)}
            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Send Reminder
          </button>
        )}
        {booking.depositStatus === 'PENDING' && onRequestDeposit && (
          <button
            onClick={() => onRequestDeposit(booking.id)}
            className="text-xs px-2 py-1 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors text-yellow-700"
          >
            Request Deposit
          </button>
        )}
      </div>
    </div>
  );
}

export function ClientInfoPanel({
  clientPhone,
  clientName,
  clientEmail,
  nextBooking,
  currentBooking,
  stats,
  isTrusted,
  onToggleTrusted,
  onReschedule,
  onCancel,
  onSendReminder,
  onRequestDeposit,
  notes,
  calendarSynced = false,
  outstandingCents = 0,
  auditLogs = [],
  waitlistEntries = [],
}: ClientInfoPanelProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-600 font-medium text-lg">
              {(clientName?.[0] || clientPhone[2] || '?').toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              {clientName || 'Unknown Client'}
            </h2>
            <p className="text-sm text-gray-500">{formatPhoneNumber(clientPhone)}</p>
            {clientEmail && (
              <p className="text-sm text-gray-500">{clientEmail}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onToggleTrusted}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors',
              isTrusted
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {isTrusted ? '⭐ Trusted Client' : '☆ Mark as Trusted'}
          </button>
          {calendarSynced && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              📅 Calendar synced
            </span>
          )}
          {outstandingCents > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
              Outstanding ${(outstandingCents / 100).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {currentBooking && (
          <BookingCard
            booking={currentBooking}
            label="Current Appointment"
            onReschedule={onReschedule}
            onCancel={onCancel}
            onSendReminder={onSendReminder}
            onRequestDeposit={onRequestDeposit}
          />
        )}

        {nextBooking && nextBooking.id !== currentBooking?.id && (
          <BookingCard
            booking={nextBooking}
            label="Next Appointment"
            onReschedule={onReschedule}
            onCancel={onCancel}
            onSendReminder={onSendReminder}
            onRequestDeposit={onRequestDeposit}
          />
        )}

        {!currentBooking && !nextBooking && (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
            No upcoming appointments
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Client Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{stats.totalVisits}</p>
              <p className="text-xs text-gray-500">Total Visits</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">
                ${stats.lifetimeRevenue.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Lifetime Revenue</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                ${stats.averageSpend.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Average Spend</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-600">{stats.noShows}</p>
              <p className="text-xs text-gray-500">No Shows</p>
            </div>
          </div>
          {stats.lastVisit && (
            <p className="mt-2 text-xs text-gray-500">
              Last visit: {format(new Date(stats.lastVisit), 'MMM d, yyyy')}
            </p>
          )}
          {stats.cancellations > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Cancellations: {stats.cancellations}
            </p>
          )}
        </div>

        {notes && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{notes}</p>
          </div>
        )}

        {(currentBooking || nextBooking) && (
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => alert('Demo mode: recorded as paid in person')}
              className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full"
            >
              Mark paid in person
            </button>
          </div>
        )}

        {waitlistEntries.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Waitlist</h3>
            {waitlistEntries.map((entry) => (
              <p key={entry.id} className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2">
                {entry.serviceName || 'Any service'} · {entry.status}
              </p>
            ))}
          </div>
        )}

        {auditLogs.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">AI action log</h3>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{format(new Date(log.createdAt), 'MMM d, h:mm a')}</p>
                  <p className="text-sm text-gray-800">{log.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
