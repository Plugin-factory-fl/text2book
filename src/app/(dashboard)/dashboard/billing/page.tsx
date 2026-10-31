'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Subscription {
  status: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const subscriptionStatus = searchParams.get('subscription');

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSubscription();
  }, []);

  useEffect(() => {
    if (subscriptionStatus === 'success') {
      setMessage('Subscription activated successfully!');
      fetchSubscription();
    } else if (subscriptionStatus === 'cancelled') {
      setMessage('Checkout was cancelled.');
    }
  }, [subscriptionStatus]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/business');
      if (response.ok) {
        const data = await response.json();
        if (data.business) {
          const userResponse = await fetch('/api/auth/session');
          if (userResponse.ok) {
            // Re-fetch with subscription data
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      setMessage('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to open billing portal');
      }
    } catch (error) {
      setMessage('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.'
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/cancel', {
        method: 'POST',
      });

      if (response.ok) {
        setMessage('Subscription will be cancelled at the end of the billing period.');
        fetchSubscription();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      setMessage('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const displays: Record<string, { label: string; color: string }> = {
      TRIAL: { label: 'Free Trial', color: 'bg-blue-100 text-blue-800' },
      ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800' },
      PAST_DUE: { label: 'Past Due', color: 'bg-red-100 text-red-800' },
      CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
      INCOMPLETE: { label: 'Incomplete', color: 'bg-yellow-100 text-yellow-800' },
    };

    return displays[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-1">
          Manage your subscription and payment methods
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('success') || message.includes('activated')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Current Plan</h2>
            {subscription && (
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  getStatusDisplay(subscription.status).color
                }`}
              >
                {getStatusDisplay(subscription.status).label}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Text2Book Pro
              </h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                $19.99<span className="text-lg text-gray-500 font-normal">/month</span>
              </p>
            </div>

            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Dedicated phone number
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AI booking assistant
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Google Calendar sync
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Automatic confirmations and reminders
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Up to 500 SMS per month
              </li>
            </ul>

            {subscription?.trialEndsAt && subscription.status === 'TRIAL' && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Your free trial ends on{' '}
                  <span className="font-semibold">
                    {format(new Date(subscription.trialEndsAt), 'MMMM d, yyyy')}
                  </span>
                </p>
              </div>
            )}

            {subscription?.currentPeriodEnd && subscription.status === 'ACTIVE' && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  {subscription.cancelAtPeriodEnd
                    ? 'Your subscription will end on '
                    : 'Your next billing date is '}
                  <span className="font-semibold">
                    {format(new Date(subscription.currentPeriodEnd), 'MMMM d, yyyy')}
                  </span>
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {(!subscription || subscription.status === 'TRIAL' || subscription.status === 'CANCELLED') && (
                <Button onClick={handleSubscribe} isLoading={isProcessing}>
                  Subscribe Now
                </Button>
              )}

              {subscription?.status === 'ACTIVE' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    isLoading={isProcessing}
                  >
                    Manage Payment
                  </Button>
                  {!subscription.cancelAtPeriodEnd && (
                    <Button
                      variant="ghost"
                      onClick={handleCancel}
                      disabled={isProcessing}
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </>
              )}

              {subscription?.status === 'PAST_DUE' && (
                <Button onClick={handleManageBilling} isLoading={isProcessing}>
                  Update Payment Method
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading billing...</div>}>
      <BillingContent />
    </Suspense>
  );
}
