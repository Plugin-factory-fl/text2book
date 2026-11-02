'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { mockSubscription, mockUsage } from '@/data/mock-data';

const plans = [
  { id: 'STARTER', name: 'Starter', price: '$19.99 per month', segs: '500 text segments included' },
  { id: 'GROWTH', name: 'Growth', price: '$29.99 per month', segs: '850 text segments included' },
  { id: 'PRO', name: 'Pro', price: '$39.99 per month', segs: '1200 text segments included' },
];

export default function BillingPage() {
  const percent = Math.round((mockUsage.used / mockUsage.cap) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600 mt-1">
          Plans priced so gross margin stays at least 50%
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">This month usage</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-2">
            {mockUsage.used} of {mockUsage.cap} text segments on Starter
          </p>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-sm text-amber-700 mt-2">
            You have used {percent}% of this month texts. Upgrade to Growth to keep conversations flowing.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.id === mockUsage.tier ? 'border-blue-400' : ''}>
            <CardHeader>
              <h2 className="text-lg font-semibold">{plan.name}</h2>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{plan.price}</p>
              <p className="text-sm text-gray-600 mt-1">{plan.segs}</p>
              <Button
                className="mt-4"
                variant={plan.id === mockUsage.tier ? 'outline' : 'primary'}
                onClick={() => alert('Demo mode: Stripe checkout is a placeholder only')}
              >
                {plan.id === mockUsage.tier ? 'Current plan' : `Upgrade to ${plan.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        Next billing date {format(new Date(mockSubscription.currentPeriodEnd), 'MMMM d, yyyy')}
      </p>
    </div>
  );
}
