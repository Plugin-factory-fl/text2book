'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConversationList } from '@/components/dashboard/conversation-list';
import { AssistantChat } from '@/components/dashboard/assistant-chat';
import { SmsThread } from '@/components/dashboard/sms-thread';
import { ClientInfoPanel } from '@/components/dashboard/client-info-panel';
import { BusinessOverviewPanel } from '@/components/dashboard/business-overview-panel';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { cn } from '@/lib/utils';

const PANEL_STORAGE_KEY = 'text2book-panel-state';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  createdAt: string;
}

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

interface InternalNote {
  id: string;
  noteType: 'CONSULT' | 'RESPONSE' | 'ESCALATION' | 'DIRECTIVE' | 'INJECTION_ATTEMPT';
  content: string;
  fromAgent: string;
  toAgent: string | null;
  wasFiltered: boolean;
  filterReason: string | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  clientPhone: string;
  clientName: string | null;
  state: string;
  lastActivity: string;
  messages: Message[];
  bookings?: Booking[];
  isTrusted?: boolean;
  unreadCount?: number;
  internalNotes?: InternalNote[];
}

interface Metrics {
  totalClients: number;
  activeConversations: number;
  conversationsNeedingAttention: number;
  unpaidDeposits: number;
  todayBookings: number;
  upcomingBookings: number;
}

interface Escalation {
  conversationId: string;
  clientName: string | null;
  clientPhone: string;
  reason: string;
  timestamp: string;
}

interface ClientStats {
  totalVisits: number;
  lifetimeRevenue: number;
  noShows: number;
  cancellations: number;
  lastVisit: string | null;
  averageSpend: number;
}

interface DashboardClientProps {
  userName: string;
  businessName: string;
  phoneNumber: string | null;
  conversations: Conversation[];
  clientStats: Record<string, ClientStats>;
  trustedPhones: string[];
  metrics?: Metrics;
  recentEscalations?: Escalation[];
}

export function DashboardClient({
  userName,
  businessName,
  phoneNumber,
  conversations,
  clientStats,
  trustedPhones: initialTrustedPhones,
  metrics,
  recentEscalations = [],
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isAssistantSelected, setIsAssistantSelected] = useState(true);
  const [trustedPhones, setTrustedPhones] = useState<string[]>(initialTrustedPhones);
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'info'>('list');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        if (typeof state.right === 'boolean') setIsRightPanelOpen(state.right);
        if (typeof state.left === 'boolean') setIsLeftPanelOpen(state.left);
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({
      right: isRightPanelOpen,
      left: isLeftPanelOpen,
    }));
  }, [isRightPanelOpen, isLeftPanelOpen]);

  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam) {
      const convo = conversations.find((c) => c.id === conversationParam);
      if (convo) {
        setSelectedConversationId(conversationParam);
        setIsAssistantSelected(false);
      }
    }
  }, [searchParams, conversations]);

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen((prev) => !prev);
  }, []);

  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelOpen((prev) => !prev);
  }, []);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

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
    async (message: string) => {
      if (!selectedConversation) return;

      await fetch('/api/conversations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message,
        }),
      });
    },
    [selectedConversation]
  );

  const handleToggleTrusted = useCallback(async () => {
    if (!selectedConversation) return;

    const phone = selectedConversation.clientPhone.slice(-10);
    const isTrusted = trustedPhones.includes(phone);

    if (isTrusted) {
      await fetch('/api/trusted-clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedConversation.clientPhone }),
      });
      setTrustedPhones((prev) => prev.filter((p) => p !== phone));
    } else {
      await fetch('/api/trusted-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConversation.clientPhone,
          name: selectedConversation.clientName,
        }),
      });
      setTrustedPhones((prev) => [...prev, phone]);
    }
  }, [selectedConversation, trustedPhones]);

  const getClientStats = (phone: string): ClientStats => {
    const normalizedPhone = phone.slice(-10);
    return (
      clientStats[normalizedPhone] || {
        totalVisits: 0,
        lifetimeRevenue: 0,
        noShows: 0,
        cancellations: 0,
        lastVisit: null,
        averageSpend: 0,
      }
    );
  };

  const getNextBooking = (conversation: Conversation): Booking | null => {
    const now = new Date();
    return (
      conversation.bookings?.find(
        (b) =>
          (b.status === 'CONFIRMED' || b.status === 'AWAITING_DEPOSIT') &&
          new Date(b.startTime) > now
      ) || null
    );
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
        {/* Left Panel (Conversation List) */}
        <div
          className={cn(
            'flex-shrink-0 transition-all duration-300 ease-in-out',
            isLeftPanelOpen ? 'w-full md:w-80 lg:w-96' : 'w-0',
            mobileView !== 'list' && 'hidden md:block'
          )}
        >
          <div className={cn('h-full border-r border-gray-200 bg-white shadow-sm', !isLeftPanelOpen && 'hidden')}>
            <ConversationList
              conversations={conversations.map((c) => ({
                ...c,
                isTrusted: trustedPhones.includes(c.clientPhone.slice(-10)),
              }))}
              selectedId={selectedConversationId}
              onSelect={handleConversationSelect}
              isAssistantSelected={isAssistantSelected}
              onAssistantSelect={handleAssistantSelect}
              businessName={businessName}
            />
          </div>
        </div>

        {/* Middle Panel (Chat/Assistant) */}
        <div
          className={cn(
            'flex-1 min-w-0 flex flex-col',
            mobileView !== 'chat' && 'hidden md:flex'
          )}
        >
          {/* Middle Panel Header with toggle buttons */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
              <PanelToggle
                isOpen={isLeftPanelOpen}
                onClick={toggleLeftPanel}
                direction="left"
                label={isLeftPanelOpen ? 'Hide conversations' : 'Show conversations'}
                className="hidden md:block"
              />
              <span className="text-sm font-medium text-gray-700">
                {isAssistantSelected
                  ? 'Chief Assistant'
                  : selectedConversation?.clientName || 'Chat'}
              </span>
            </div>
            <PanelToggle
              isOpen={isRightPanelOpen}
              onClick={toggleRightPanel}
              direction="right"
              label={isRightPanelOpen ? 'Hide info panel' : 'Show info panel'}
              className="hidden lg:block"
            />
          </div>

          {/* Chat Content */}
          <div className="flex-1 min-h-0">
            {isAssistantSelected ? (
              <AssistantChat
                clientContext={null}
                onActionComplete={() => {
                  window.location.reload();
                }}
              />
            ) : selectedConversation ? (
              <SmsThread
                messages={selectedConversation.messages}
                clientName={selectedConversation.clientName}
                clientPhone={selectedConversation.clientPhone}
                onSendMessage={handleSendMessage}
                isAiActive={selectedConversation.state !== 'OWNER_TAKEOVER'}
                onTakeOver={async () => {
                  await fetch('/api/conversations/takeover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversationId: selectedConversation.id }),
                  });
                  window.location.reload();
                }}
                internalNotes={selectedConversation.internalNotes}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <p className="text-lg font-medium">Welcome back, {userName}!</p>
                  <p className="text-sm mt-1">
                    Select a conversation or chat with your assistant
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (Info/Overview) */}
        <div
          className={cn(
            'flex-shrink-0 transition-all duration-300 ease-in-out',
            isRightPanelOpen ? 'w-80 lg:w-96' : 'w-0',
            mobileView !== 'info' && 'hidden lg:block'
          )}
        >
          <div className={cn('h-full border-l border-gray-200 bg-white shadow-sm rounded-l-lg overflow-hidden', !isRightPanelOpen && 'hidden')}>
            {isAssistantSelected && metrics ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                  <span className="text-sm font-medium text-gray-700">Business Overview</span>
                  <PanelToggle
                    isOpen={isRightPanelOpen}
                    onClick={toggleRightPanel}
                    direction="right"
                    label="Hide info panel"
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <BusinessOverviewPanel
                    businessName={businessName}
                    metrics={metrics}
                    recentEscalations={recentEscalations}
                    conversationAiStatuses={conversations.map((c) => ({
                      id: c.id,
                      clientName: c.clientName,
                      clientPhone: c.clientPhone,
                      state: c.state,
                      isAiHandling: c.state !== 'OWNER_TAKEOVER' && c.state !== 'ESCALATE',
                    }))}
                    onConversationSelect={handleConversationSelect}
                  />
                </div>
              </div>
            ) : selectedConversation ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                  <span className="text-sm font-medium text-gray-700">Client Details</span>
                  <PanelToggle
                    isOpen={isRightPanelOpen}
                    onClick={toggleRightPanel}
                    direction="right"
                    label="Hide info panel"
                  />
                </div>
                <div className="flex-1 overflow-hidden">
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
                      window.location.href = `/dashboard/calendar?reschedule=${bookingId}`;
                    }}
                    onCancel={async (bookingId) => {
                      if (confirm('Are you sure you want to cancel this booking?')) {
                        await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
                        window.location.reload();
                      }
                    }}
                    onSendReminder={async (bookingId) => {
                      await fetch(`/api/bookings/${bookingId}/reminder`, { method: 'POST' });
                      alert('Reminder sent!');
                    }}
                    onRequestDeposit={async (bookingId) => {
                      await fetch(`/api/bookings/${bookingId}/deposit-reminder`, { method: 'POST' });
                      alert('Deposit reminder sent!');
                    }}
                    notes={selectedConversation.bookings?.[0]?.notes}
                    calendarSynced={false}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
