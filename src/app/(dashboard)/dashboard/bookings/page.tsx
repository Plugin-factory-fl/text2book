'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingCalendar, BookingDetailModal, CalendarBooking } from '@/components/ui/booking-calendar';
import { format } from 'date-fns';
import { formatPhoneNumber, formatCurrency, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceName: string;
  duration: number;
  price: number | null;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  confirmationSent: boolean;
  reminderSent: boolean;
  depositRequired: boolean;
  depositAmount: number | null;
  depositStatus: string;
}

type ViewType = 'calendar' | 'list';
type FilterType = 'upcoming' | 'all' | 'cancelled';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>('calendar');
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'upcoming') {
        params.set('upcoming', 'true');
      } else if (filter === 'cancelled') {
        params.set('status', 'CANCELLED');
      }

      const response = await fetch(`/api/bookings?${params}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (response.ok) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error);
    }
  };

  const handleMarkComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (response.ok) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Failed to mark booking complete:', error);
    }
  };

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

  const calendarBookings: CalendarBooking[] = bookings.map((b) => ({
    id: b.id,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    clientEmail: b.clientEmail,
    serviceName: b.serviceName,
    duration: b.duration,
    price: b.price,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes,
    depositRequired: b.depositRequired,
    depositAmount: b.depositAmount,
    depositStatus: b.depositStatus,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <div className="flex flex-wrap gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewType('calendar')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                viewType === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </button>
            <button
              onClick={() => setViewType('list')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 flex items-center gap-1.5',
                viewType === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
          </div>

          {/* Filter buttons (list view only) */}
          {viewType === 'list' && (
            <div className="flex space-x-2">
              <Button
                variant={filter === 'upcoming' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('upcoming')}
              >
                Upcoming
              </Button>
              <Button
                variant={filter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'cancelled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('cancelled')}
              >
                Cancelled
              </Button>
            </div>
          )}
        </div>
      </div>

      {viewType === 'calendar' ? (
        <BookingCalendar
          bookings={calendarBookings}
          onBookingClick={setSelectedBooking}
          isLoading={isLoading}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No bookings found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {booking.clientName}
                          </h3>
                          {getStatusBadge(booking.status)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {booking.serviceName} ({formatDuration(booking.duration)})
                          {booking.price && ` · ${formatCurrency(booking.price)}`}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatPhoneNumber(booking.clientPhone)}
                          {booking.clientEmail && ` · ${booking.clientEmail}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {format(new Date(booking.startTime), 'EEEE, MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(booking.startTime), 'h:mm a')} to{' '}
                          {format(new Date(booking.endTime), 'h:mm a')}
                        </p>
                        <div className="flex gap-2 mt-2 justify-end">
                          {booking.status === 'CONFIRMED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkComplete(booking.id)}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleCancel(booking.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {booking.notes && (
                      <p className="text-sm text-gray-500 mt-3 pt-3 border-t">
                        Notes: {booking.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={handleCancel}
        onComplete={handleMarkComplete}
        formatPhone={formatPhoneNumber}
        formatMoney={formatCurrency}
        formatTime={formatDuration}
      />
    </div>
  );
}
