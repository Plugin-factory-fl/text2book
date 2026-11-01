import { redirect } from 'next/navigation';

export default function ConversationsPage({
  searchParams,
}: {
  searchParams: { conversation?: string };
}) {
  const conversationId = searchParams.conversation;
  if (conversationId) {
    redirect(`/dashboard?conversation=${conversationId}`);
  }
  redirect('/dashboard');
}
