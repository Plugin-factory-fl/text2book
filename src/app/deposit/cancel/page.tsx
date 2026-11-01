'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CancelContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Not Completed
        </h1>
        <p className="text-gray-600 mb-6">
          Your appointment is being held temporarily. Please complete the deposit payment within the time limit to confirm your booking, or the slot will be released.
        </p>
        <p className="text-sm text-gray-500">
          You can return to the payment link we sent you via text message to complete your deposit.
        </p>
      </div>
    </div>
  );
}

export default function DepositCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <CancelContent />
    </Suspense>
  );
}
