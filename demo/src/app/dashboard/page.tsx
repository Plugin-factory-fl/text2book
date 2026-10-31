'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils';
import { mockUser, mockBusiness, mockBookings, mockConversations, mockSubscription } from '@/data/mock-data';

export default function DashboardPage() {
  const upcomingBookings = mockBookings
    .filter(b => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date())
    .slice(0, 5);

  const recentConversations = mockConversations.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {mockUser.name.split(' ')[0]}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here is what is happening with {mockBusiness.name}
        </p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            Your booking number:{' '}
            <span className="font-semibold">
              {formatPhoneNumber(mockBusiness.phoneNumber.phoneNumber)}
            </span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Share this number with your clients so they can text to book appointments
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Upcoming Bookings</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {mockBusiness._count.bookings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Total Conversations</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {mockBusiness._count.conversations}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500">Subscription Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">
              {mockSubscription.status.toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Upcoming Bookings
              </h2>
              <Link
                href="/dashboard/bookings"
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming bookings</p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.clientName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {booking.serviceName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(booking.startTime), 'MMM d')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(booking.startTime), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Conversations
              </h2>
              <Link
                href="/dashboard/conversations"
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentConversations.length === 0 ? (
              <p className="text-gray-500 text-sm">No conversations yet</p>
            ) : (
              <div className="space-y-3">
                {recentConversations.map((convo) => (
                  <Link
                    key={convo.id}
                    href={`/dashboard/conversations?id=${convo.id}`}
                    className="block py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {convo.clientName || formatPhoneNumber(convo.clientPhone)}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">
                          {convo.messages[convo.messages.length - 1]?.content || 'No messages'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {format(new Date(convo.lastActivity), 'MMM d')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
