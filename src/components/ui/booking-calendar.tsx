'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isToday,
  parseISO,
} from 'date-fns';
import { cn } from '@/lib/utils';

export interface CalendarBooking {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  serviceName: string;
  duration: number;
  price?: number | null;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  depositRequired?: boolean;
  depositAmount?: number | null;
  depositStatus?: string;
}

interface BookingCalendarProps {
  bookings: CalendarBooking[];
  onBookingClick: (booking: CalendarBooking) => void;
  isLoading?: boolean;
}

type ViewMode = 'week' | 'month';

export function BookingCalendar({ bookings, onBookingClick, isLoading }: BookingCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  }, [viewMode, currentDate]);

  const days = useMemo(() => {
    if (viewMode === 'week') {
      return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  }, [viewMode, currentDate, dateRange]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    bookings.forEach((booking) => {
      const dateKey = format(parseISO(booking.startTime), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      existing.push(booking);
      map.set(dateKey, existing);
    });
    return map;
  }, [bookings]);

  const goToToday = () => setCurrentDate(new Date());
  
  const goToPrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const getStatusColor = (status: string, depositStatus?: string) => {
    if (status === 'AWAITING_DEPOSIT') {
      return 'bg-orange-500';
    }
    switch (status) {
      case 'CONFIRMED':
        return depositStatus === 'PAID' ? 'bg-green-600' : 'bg-green-500';
      case 'PENDING':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-blue-500';
      case 'CANCELLED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDepositIcon = (depositRequired?: boolean, depositStatus?: string): { icon: string; label: string } | null => {
    if (!depositRequired) return null;
    if (depositStatus === 'PAID') return { icon: '💵✅', label: 'Deposit Paid' };
    if (depositStatus === 'PENDING') return { icon: '💵⏳', label: 'Deposit Pending' };
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-gray-500">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500"></span> Confirmed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-500"></span> Awaiting Deposit
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500"></span> Completed
        </span>
        <span className="flex items-center gap-1">💵✅ Deposit Paid</span>
        <span className="flex items-center gap-1">💵⏳ Deposit Pending</span>
      </div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-2">
              {viewMode === 'week'
                ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-300',
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={cn(
        'grid grid-cols-7',
        viewMode === 'week' ? 'min-h-[400px]' : ''
      )}>
        {days.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayBookings = bookingsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={dateKey}
              className={cn(
                'border-b border-r border-gray-200 p-1',
                viewMode === 'week' ? 'min-h-[100px]' : 'min-h-[80px] sm:min-h-[100px]',
                index % 7 === 0 && 'border-l',
                !isCurrentMonth && viewMode === 'month' && 'bg-gray-50'
              )}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                  isDayToday && 'bg-blue-600 text-white',
                  !isDayToday && isCurrentMonth && 'text-gray-900',
                  !isDayToday && !isCurrentMonth && 'text-gray-400'
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayBookings.slice(0, viewMode === 'week' ? 5 : 3).map((booking) => {
                  const depositIcon = getDepositIcon(booking.depositRequired, booking.depositStatus);
                  return (
                    <button
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className={cn(
                        'w-full text-left px-1.5 py-0.5 rounded text-xs truncate text-white transition-opacity hover:opacity-80',
                        getStatusColor(booking.status, booking.depositStatus)
                      )}
                      title={`${booking.clientName} - ${booking.serviceName}${depositIcon ? ` (${depositIcon.label})` : ''}`}
                    >
                      <span className="hidden sm:inline">{format(parseISO(booking.startTime), 'h:mm a')} </span>
                      {booking.clientName}
                      {depositIcon && <span className="ml-1">{depositIcon.icon}</span>}
                    </button>
                  );
                })}
                {dayBookings.length > (viewMode === 'week' ? 5 : 3) && (
                  <p className="text-xs text-gray-500 px-1">
                    +{dayBookings.length - (viewMode === 'week' ? 5 : 3)} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BookingDetailModalProps {
  booking: CalendarBooking | null;
  onClose: () => void;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  formatPhone: (phone: string) => string;
  formatMoney: (amount: number) => string;
  formatTime: (minutes: number) => string;
}

export function BookingDetailModal({
  booking,
  onClose,
  onCancel,
  onComplete,
  formatPhone,
  formatMoney,
  formatTime,
}: BookingDetailModalProps) {
  if (!booking) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      AWAITING_DEPOSIT: 'bg-orange-100 text-orange-800',
      CANCELLED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      NO_SHOW: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getDepositBadge = (depositStatus: string | undefined, amount: number | null | undefined) => {
    if (!depositStatus || depositStatus === 'NOT_REQUIRED') return null;
    
    const styles: Record<string, string> = {
      PENDING: 'bg-orange-100 text-orange-800',
      PAID: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      REFUNDED: 'bg-purple-100 text-purple-800',
    };

    const amountText = amount ? ` ($${(amount / 100).toFixed(0)})` : '';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[depositStatus] || 'bg-gray-100 text-gray-800'}`}>
        Deposit: {depositStatus}{amountText}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{booking.clientName}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {getStatusBadge(booking.status)}
              {getDepositBadge(booking.depositStatus, booking.depositAmount)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">Service</p>
            <p className="font-medium text-gray-900">
              {booking.serviceName} ({formatTime(booking.duration)})
              {booking.price && ` · ${formatMoney(booking.price)}`}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Date and Time</p>
            <p className="font-medium text-gray-900">
              {format(parseISO(booking.startTime), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-gray-600">
              {format(parseISO(booking.startTime), 'h:mm a')} to {format(parseISO(booking.endTime), 'h:mm a')}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{formatPhone(booking.clientPhone)}</p>
          </div>

          {booking.depositRequired && (
            <div>
              <p className="text-sm text-gray-500">Deposit</p>
              <p className="font-medium text-gray-900">
                {booking.depositStatus === 'PAID' && '💵✅ Paid'}
                {booking.depositStatus === 'PENDING' && '💵⏳ Pending'}
                {booking.depositStatus === 'EXPIRED' && '❌ Expired'}
                {booking.depositAmount && ` ($${(booking.depositAmount / 100).toFixed(0)})`}
              </p>
            </div>
          )}

          {booking.clientEmail && (
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{booking.clientEmail}</p>
            </div>
          )}

          {booking.notes && (
            <div>
              <p className="text-sm text-gray-500">Notes</p>
              <p className="text-gray-700">{booking.notes}</p>
            </div>
          )}
        </div>

        {booking.status === 'CONFIRMED' && (onCancel || onComplete) && (
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
            {onComplete && (
              <button
                onClick={() => {
                  onComplete(booking.id);
                  onClose();
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Mark Complete
              </button>
            )}
            {onCancel && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this booking?')) {
                    onCancel(booking.id);
                    onClose();
                  }
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Cancel Booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
