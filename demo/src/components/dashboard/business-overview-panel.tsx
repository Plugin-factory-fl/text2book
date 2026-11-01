'use client';

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface ConversationAiStatus {
  id: string;
  clientName: string | null;
  clientPhone: string;
  state: string;
  isAiHandling: boolean;
}

interface BusinessOverviewPanelProps {
  businessName: string;
  metrics: Metrics;
  recentEscalations: Escalation[];
  conversationAiStatuses: ConversationAiStatus[];
  onConversationSelect: (id: string) => void;
}

function getStateLabel(state: string): { label: string; color: string } {
  const states: Record<string, { label: string; color: string }> = {
    GREETING: { label: 'Greeting', color: 'text-gray-600 bg-gray-100' },
    COLLECTING_SERVICE: { label: 'Collecting Service', color: 'text-blue-600 bg-blue-100' },
    COLLECTING_TIME: { label: 'Collecting Time', color: 'text-blue-600 bg-blue-100' },
    COLLECTING_NAME: { label: 'Collecting Name', color: 'text-blue-600 bg-blue-100' },
    COLLECTING_DETAILS: { label: 'Collecting Details', color: 'text-blue-600 bg-blue-100' },
    CONFIRMING: { label: 'Confirming', color: 'text-purple-600 bg-purple-100' },
    BOOKING_COMPLETE: { label: 'Complete', color: 'text-green-600 bg-green-100' },
    BOOKING_CONFIRMED: { label: 'Confirmed', color: 'text-green-600 bg-green-100' },
    FAQ: { label: 'FAQ', color: 'text-gray-600 bg-gray-100' },
    FAQ_ANSWERED: { label: 'FAQ Answered', color: 'text-gray-600 bg-gray-100' },
    RESCHEDULE: { label: 'Rescheduling', color: 'text-yellow-600 bg-yellow-100' },
    CANCEL: { label: 'Cancelling', color: 'text-red-600 bg-red-100' },
    ESCALATE: { label: 'Needs Attention', color: 'text-orange-600 bg-orange-100' },
    OWNER_TAKEOVER: { label: 'Owner Handling', color: 'text-indigo-600 bg-indigo-100' },
  };
  return states[state] || { label: state, color: 'text-gray-600 bg-gray-100' };
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function BusinessOverviewPanel({
  businessName,
  metrics,
  recentEscalations,
  conversationAiStatuses,
  onConversationSelect,
}: BusinessOverviewPanelProps) {
  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Business Overview</h2>
        <p className="text-sm text-gray-500">{businessName}</p>
      </div>

      {/* Metrics Grid */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Today&apos;s Snapshot</h3>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Today&apos;s Bookings"
            value={metrics.todayBookings}
            icon="📅"
          />
          <MetricCard
            label="Upcoming"
            value={metrics.upcomingBookings}
            icon="📆"
          />
          <MetricCard
            label="Active Chats"
            value={metrics.activeConversations}
            icon="💬"
          />
          <MetricCard
            label="Total Clients"
            value={metrics.totalClients}
            icon="👥"
          />
        </div>
      </div>

      {/* Attention Needed */}
      {(metrics.conversationsNeedingAttention > 0 || metrics.unpaidDeposits > 0) && (
        <div className="p-6 border-b border-gray-200 bg-orange-50">
          <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Needs Attention
          </h3>
          <div className="space-y-2">
            {metrics.conversationsNeedingAttention > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-700">Escalated conversations</span>
                <span className="font-semibold text-orange-900">{metrics.conversationsNeedingAttention}</span>
              </div>
            )}
            {metrics.unpaidDeposits > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-700">Unpaid deposits</span>
                <span className="font-semibold text-orange-900">{metrics.unpaidDeposits}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Escalations */}
      {recentEscalations.length > 0 && (
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Escalations</h3>
          <div className="space-y-3">
            {recentEscalations.slice(0, 5).map((escalation, i) => (
              <button
                key={i}
                onClick={() => onConversationSelect(escalation.conversationId)}
                className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">
                    {escalation.clientName || formatPhoneNumber(escalation.clientPhone)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(escalation.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{escalation.reason}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Status per Conversation */}
      <div className="p-6 flex-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">AI Handling Status</h3>
        <div className="space-y-2">
          {conversationAiStatuses.slice(0, 10).map((conv) => {
            const stateInfo = getStateLabel(conv.state);
            return (
              <button
                key={conv.id}
                onClick={() => onConversationSelect(conv.id)}
                className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      conv.isAiHandling ? 'bg-green-500' : 'bg-gray-400'
                    )}
                  />
                  <span className="text-sm text-gray-900 truncate">
                    {conv.clientName || formatPhoneNumber(conv.clientPhone)}
                  </span>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', stateInfo.color)}>
                  {stateInfo.label}
                </span>
              </button>
            );
          })}
          {conversationAiStatuses.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No active conversations</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-gray-50">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
