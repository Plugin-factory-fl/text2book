'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatPhoneNumber, formatCurrency, formatDuration } from '@/lib/utils';
import { mockBookings } from '@/data/mock-data';
import { BookingCalendar, BookingDetailModal, CalendarBooking } from '@/components/ui/booking-calendar';

type ViewTab = 'calendar' | 'list';
type FilterType = 'upcoming' | 'all' | 'cancelled';

export default function BookingsPage() {
  const [viewTab, setViewTab] = useState<ViewTab>('calendar');
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  const filteredBookings = mockBookings.filter((booking) => {
    if (filter === 'upcoming') {
      return booking.status === 'CONFIRMED' && new Date(booking.startTime) > new Date();
    }
    if (filter === 'cancelled') {
      return booking.status === 'CANCELLED';
    }
    return true;
  });

  const calendarBookings: CalendarBooking[] = mockBookings.map((booking) => ({
    id: booking.id,
    clientName: booking.clientName,
    clientPhone: booking.clientPhone,
    clientEmail: booking.clientEmail,
    serviceName: booking.serviceName,
    duration: booking.duration,
    price: booking.price,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    notes: booking.notes,
  }));

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      CONFIRMED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setViewTab('calendar')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewTab === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewTab('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              viewTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewTab === 'calendar' ? (
        <>
          <BookingCalendar
            bookings={calendarBookings}
            onBookingClick={(booking) => setSelectedBooking(booking)}
          />
          <BookingDetailModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            formatPhone={formatPhoneNumber}
            formatMoney={formatCurrency}
            formatTime={formatDuration}
          />
        </>
      ) : (
        <>
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

          {filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No bookings found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
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
                                onClick={() => alert('Demo mode: Marking booking complete')}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => alert('Demo mode: Cancelling booking')}
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
    </div>
  );
}
