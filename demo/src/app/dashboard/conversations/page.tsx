'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ConversationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');

  useEffect(() => {
    if (conversationId) {
      router.replace(`/dashboard?conversation=${conversationId}`);
    } else {
      router.replace('/dashboard');
    }
  }, [conversationId, router]);

  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)] flex items-center justify-center"><p className="text-gray-500">Redirecting...</p></div>}>
      <ConversationsContent />
    </Suspense>
  );
}
