'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/dashboard/conversation-list';
import { AssistantChat } from '@/components/dashboard/assistant-chat';
import { SmsThread } from '@/components/dashboard/sms-thread';
import { ClientInfoPanel } from '@/components/dashboard/client-info-panel';
import { BusinessOverviewPanel } from '@/components/dashboard/business-overview-panel';
import { cn } from '@/lib/utils';
import { 
  mockUser, 
  mockBusiness, 
  mockConversations, 
  mockBookings, 
  mockTrustedClients, 
  mockInternalNotes,
  mockMetrics,
  mockEscalations,
} from '@/data/mock-data';

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  serviceName: string;
  duration: number;
  price: number;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  depositRequired?: boolean;
  depositAmount?: number | null;
  depositStatus?: string;
}

interface ClientStats {
  totalVisits: number;
  lifetimeRevenue: number;
  noShows: number;
  cancellations: number;
  lastVisit: string | null;
  averageSpend: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isAssistantSelected, setIsAssistantSelected] = useState(true);
  const [trustedPhones, setTrustedPhones] = useState<string[]>(
    mockTrustedClients.map((tc) => tc.phone.slice(-10))
  );
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  const [localMessages, setLocalMessages] = useState<Record<string, typeof mockConversations[0]['messages']>>({});

  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam) {
      const convo = mockConversations.find((c) => c.id === conversationParam);
      if (convo) {
        setSelectedConversationId(conversationParam);
        setIsAssistantSelected(false);
      }
    }
  }, [searchParams]);

  const conversationsWithBookings = mockConversations.map((conv) => ({
    ...conv,
    bookings: mockBookings
      .filter((b) => b.clientPhone === conv.clientPhone)
      .map((b) => ({
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
      })),
    internalNotes: mockInternalNotes.filter((n) => n.conversationId === conv.id),
  }));

  const selectedConversation = conversationsWithBookings.find(
    (c) => c.id === selectedConversationId
  );

  const handleConversationSelect = (id: string | null) => {
    setSelectedConversationId(id);
    setIsAssistantSelected(false);
    setMobileView('chat');
  };

  const handleAssistantSelect = () => {
    setSelectedConversationId(null);
    setIsAssistantSelected(true);
    setMobileView('chat');
  };

  const handleSendMessage = useCallback(
    (message: string) => {
      if (!selectedConversation) return;

      const newMessage = {
        id: `msg-demo-${Date.now()}`,
        direction: 'OUTBOUND' as const,
        content: message,
        createdAt: new Date().toISOString(),
        isAi: false,
      };

      setLocalMessages((prev) => ({
        ...prev,
        [selectedConversation.id]: [...(prev[selectedConversation.id] || selectedConversation.messages), newMessage],
      }));
    },
    [selectedConversation]
  );

  const handleToggleTrusted = useCallback(() => {
    if (!selectedConversation) return;

    const phone = selectedConversation.clientPhone.slice(-10);
    const isTrusted = trustedPhones.includes(phone);

    if (isTrusted) {
      setTrustedPhones((prev) => prev.filter((p) => p !== phone));
    } else {
      setTrustedPhones((prev) => [...prev, phone]);
    }
  }, [selectedConversation, trustedPhones]);

  const getClientStats = (phone: string): ClientStats => {
    const clientBookings = mockBookings.filter(
      (b) => b.clientPhone.slice(-10) === phone.slice(-10)
    );
    const completed = clientBookings.filter((b) => b.status === 'COMPLETED');
    const noShows = clientBookings.filter((b) => b.status === 'NO_SHOW').length;
    const cancellations = clientBookings.filter((b) => b.status === 'CANCELLED').length;
    const lifetimeRevenue = completed.reduce((sum, b) => sum + b.price, 0);
    const totalVisits = completed.length;
    const averageSpend = totalVisits > 0 ? lifetimeRevenue / totalVisits : 0;
    const lastVisit = completed.length > 0 ? completed[0].startTime : null;

    return {
      totalVisits,
      lifetimeRevenue,
      noShows,
      cancellations,
      lastVisit,
      averageSpend,
    };
  };

  const getNextBooking = (conversation: typeof conversationsWithBookings[0]): Booking | null => {
    const now = new Date();
    return (
      conversation.bookings?.find(
        (b) =>
          (b.status === 'CONFIRMED' || b.status === 'AWAITING_DEPOSIT') &&
          new Date(b.startTime) > now
      ) || null
    );
  };

  const getMessages = (conversationId: string) => {
    const conv = conversationsWithBookings.find((c) => c.id === conversationId);
    return localMessages[conversationId] || conv?.messages || [];
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="md:hidden flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setMobileView('list')}
          className={cn(
            'flex-1 py-3 text-sm font-medium',
            mobileView === 'list'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          )}
        >
          Conversations
        </button>
        <button
          onClick={() => setMobileView('chat')}
          className={cn(
            'flex-1 py-3 text-sm font-medium',
            mobileView === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          )}
        >
          Chat
        </button>
        {selectedConversation && (
          <button
            onClick={() => setMobileView('info')}
            className={cn(
              'flex-1 py-3 text-sm font-medium',
              mobileView === 'info'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            )}
          >
            Client Info
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={cn(
            'w-full md:w-80 lg:w-96 flex-shrink-0',
            mobileView !== 'list' && 'hidden md:block'
          )}
        >
          <ConversationList
            conversations={conversationsWithBookings.map((c) => ({
              ...c,
              isTrusted: trustedPhones.includes(c.clientPhone.slice(-10)),
            }))}
            selectedId={selectedConversationId}
            onSelect={handleConversationSelect}
            isAssistantSelected={isAssistantSelected}
            onAssistantSelect={handleAssistantSelect}
            businessName={mockBusiness.name}
          />
        </div>

        <div
          className={cn(
            'flex-1 min-w-0',
            mobileView !== 'chat' && 'hidden md:block'
          )}
        >
          {isAssistantSelected ? (
            <AssistantChat clientContext={null} />
          ) : selectedConversation ? (
            <SmsThread
              messages={getMessages(selectedConversation.id)}
              clientName={selectedConversation.clientName}
              clientPhone={selectedConversation.clientPhone}
              onSendMessage={handleSendMessage}
              isAiActive={selectedConversation.state !== 'OWNER_TAKEOVER'}
              onTakeOver={() => {
                alert('Demo: You would now take over this conversation from the AI.');
              }}
              internalNotes={selectedConversation.internalNotes}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium">Welcome back, {mockUser.name.split(' ')[0]}!</p>
                <p className="text-sm mt-1">
                  Select a conversation or chat with your assistant
                </p>
              </div>
            </div>
          )}
        </div>

        {isAssistantSelected ? (
          <div
            className={cn(
              'w-80 lg:w-96 flex-shrink-0',
              mobileView !== 'info' && 'hidden lg:block'
            )}
          >
            <BusinessOverviewPanel
              businessName={mockBusiness.name}
              metrics={mockMetrics}
              recentEscalations={mockEscalations}
              conversationAiStatuses={conversationsWithBookings.map((c) => ({
                id: c.id,
                clientName: c.clientName,
                clientPhone: c.clientPhone,
                state: c.state,
                isAiHandling: c.state !== 'OWNER_TAKEOVER' && c.state !== 'ESCALATE',
              }))}
              onConversationSelect={handleConversationSelect}
            />
          </div>
        ) : selectedConversation ? (
          <div
            className={cn(
              'w-80 lg:w-96 flex-shrink-0',
              mobileView !== 'info' && 'hidden lg:block'
            )}
          >
            <ClientInfoPanel
              clientPhone={selectedConversation.clientPhone}
              clientName={selectedConversation.clientName}
              clientEmail={selectedConversation.bookings?.[0]?.clientEmail}
              nextBooking={getNextBooking(selectedConversation)}
              currentBooking={selectedConversation.bookings?.[0]}
              stats={getClientStats(selectedConversation.clientPhone)}
              isTrusted={trustedPhones.includes(selectedConversation.clientPhone.slice(-10))}
              onToggleTrusted={handleToggleTrusted}
              onReschedule={(bookingId) => {
                alert(`Demo: Reschedule booking ${bookingId}`);
              }}
              onCancel={(bookingId) => {
                alert(`Demo: Cancel booking ${bookingId}`);
              }}
              onSendReminder={(bookingId) => {
                alert(`Demo: Reminder sent for booking ${bookingId}`);
              }}
              onRequestDeposit={(bookingId) => {
                alert(`Demo: Deposit request sent for booking ${bookingId}`);
              }}
              notes={selectedConversation.bookings?.[0]?.notes}
              calendarSynced={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center text-gray-500">
        <p className="text-lg">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
