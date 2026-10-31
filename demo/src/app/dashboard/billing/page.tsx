'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { mockSubscription } from '@/data/mock-data';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-1">
          Manage your subscription and payment information
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Current Plan</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold text-gray-900">Text2Book Pro</p>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  {mockSubscription.status}
                </span>
              </div>
              <p className="text-gray-600 mt-1">$19.99 per month</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Next billing date</p>
              <p className="font-medium text-gray-900">
                {format(new Date(mockSubscription.currentPeriodEnd), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Plan Features</h2>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              'Dedicated booking phone number',
              'AI powered SMS booking assistant',
              'Google Calendar integration',
              'Unlimited bookings',
              'Automated reminders',
              'Up to 500 SMS messages per month',
              'Conversation history',
              'Custom FAQs',
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Payment Method</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">VISA</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Visa ending in 4242</p>
                <p className="text-sm text-gray-500">Expires 12/2025</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => alert('Demo mode: Would open Stripe portal')}>
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Billing History</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { date: new Date(Date.now() - 86400000 * 15), amount: 19.99, status: 'Paid' },
              { date: new Date(Date.now() - 86400000 * 45), amount: 19.99, status: 'Paid' },
              { date: new Date(Date.now() - 86400000 * 75), amount: 19.99, status: 'Paid' },
            ].map((invoice, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {format(invoice.date, 'MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-500">Text2Book Pro subscription</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${invoice.amount.toFixed(2)}</p>
                  <p className="text-sm text-green-600">{invoice.status}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => alert('Demo mode: Would open Stripe portal')}>
          Manage Subscription
        </Button>
        <Button variant="danger" onClick={() => alert('Demo mode: Would cancel subscription')}>
          Cancel Subscription
        </Button>
      </div>
    </div>
  );
}
