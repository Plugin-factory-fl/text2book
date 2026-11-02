'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PLAN_TIER_LIST, PlanTierId, planPublicCopy } from '@/config/pricing';

interface UsagePayload {
  tier: PlanTierId;
  used: number;
  cap: number;
  inboundSegments: number;
  outboundSegments: number;
  periodEnd: string;
}

interface Subscription {
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  tier?: PlanTierId;
}

function BillingContent() {
  const searchParams = useSearchParams();
  const subscriptionStatus = searchParams.get('subscription');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    if (subscriptionStatus === 'success') {
      setMessage('Subscription activated successfully!');
      fetchUsage();
    } else if (subscriptionStatus === 'cancelled') {
      setMessage('Checkout was cancelled.');
    }
  }, [subscriptionStatus]);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/usage');
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
        setSubscription({
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodEnd: data.periodEnd,
          cancelAtPeriodEnd: false,
          tier: data.tier,
        });
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (tier: PlanTierId) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to create checkout session');
      }
    } catch {
      setMessage('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to open billing portal');
      }
    } catch {
      setMessage('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading billing information...</p>
      </div>
    );
  }

  const currentTier = usage?.tier || 'STARTER';
  const used = usage?.used || 0;
  const cap = usage?.cap || 500;
  const percent = Math.min(100, Math.round((used / cap) * 100));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-1">
          Choose a plan by monthly text volume. Gross margin stays at least 50%.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">This month usage</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-2">
            {used} of {cap} text segments on {currentTier}
          </p>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={percent >= 100 ? 'h-full bg-red-500' : percent >= 80 ? 'h-full bg-amber-500' : 'h-full bg-blue-600'}
              style={{ width: `${percent}%` }}
            />
          </div>
          {percent >= 80 && (
            <p className="text-sm text-amber-700 mt-2">
              {percent >= 100
                ? 'Allowance reached. Upgrade or contact us for overage. In progress bookings stay open.'
                : 'You have used 80% or more of this month texts. Upgrade to keep conversations flowing.'}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_TIER_LIST.map((plan) => {
          const copy = planPublicCopy(plan);
          const isCurrent = plan.id === currentTier;
          return (
            <Card key={plan.id} className={isCurrent ? 'border-blue-400' : ''}>
              <CardHeader>
                <h2 className="text-lg font-semibold">{copy.name}</h2>
                {isCurrent && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Current plan</span>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{copy.priceLabel}</p>
                <p className="text-sm text-gray-600 mt-1">{copy.segmentsLabel}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {copy.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <Button variant="outline" onClick={handleManageBilling} isLoading={isProcessing}>
                      Manage payment
                    </Button>
                  ) : (
                    <Button onClick={() => handleSubscribe(plan.id)} isLoading={isProcessing}>
                      {PLAN_TIER_LIST.findIndex((p) => p.id === plan.id) >
                      PLAN_TIER_LIST.findIndex((p) => p.id === currentTier)
                        ? `Upgrade to ${plan.name}`
                        : `Choose ${plan.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {subscription?.currentPeriodEnd && (
        <p className="text-sm text-gray-500">
          Current period ends {format(new Date(subscription.currentPeriodEnd), 'MMMM d, yyyy')}
        </p>
      )}
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
