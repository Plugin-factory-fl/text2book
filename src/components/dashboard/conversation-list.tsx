'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChiefAvatar } from './chief-avatar';

type FilterType = 'all' | 'upcoming' | 'needs_attention' | 'unpaid_deposit';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  createdAt: string;
}

interface Booking {
  id: string;
  startTime: string;
  status: string;
  depositStatus?: string;
}

interface Conversation {
  id: string;
  clientPhone: string;
  clientName: string | null;
  state: string;
  lastActivity: string;
  messages: Message[];
  bookings?: Booking[];
  unreadCount?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isAssistantSelected: boolean;
  onAssistantSelect: () => void;
  businessName?: string;
}

function getDepositIcon(booking: Booking | undefined): { icon: string; label: string } | null {
  if (!booking) return null;
  if (booking.depositStatus === 'PAID') {
    return { icon: '💵✅', label: 'Deposit Paid' };
  }
  if (booking.depositStatus === 'PENDING') {
    return { icon: '💵⏳', label: 'Deposit Pending' };
  }
  return null;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isAssistantSelected,
  onAssistantSelect,
  businessName = 'Your Business',
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      searchQuery === '' ||
      conv.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.clientPhone.includes(searchQuery);

    if (!matchesSearch) return false;

    const upcomingBooking = conv.bookings?.find(
      (b) => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date()
    );
    const pendingDeposit = conv.bookings?.find((b) => b.depositStatus === 'PENDING');
    const needsAttention =
      conv.state === 'AWAITING_INPUT' || (conv.unreadCount && conv.unreadCount > 0);

    switch (filter) {
      case 'upcoming':
        return !!upcomingBooking;
      case 'needs_attention':
        return needsAttention;
      case 'unpaid_deposit':
        return !!pendingDeposit;
      default:
        return true;
    }
  });

  const needsAttentionCount = conversations.filter(
    (c) => c.state === 'ESCALATE' || (c.unreadCount && c.unreadCount > 0)
  ).length;

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Chief Assistant Header */}
      <button
        onClick={onAssistantSelect}
        className={cn(
          'p-6 border-b-2 border-gray-200 hover:bg-blue-50/50 transition-colors',
          isAssistantSelected && 'bg-blue-50'
        )}
      >
        <div className="flex flex-col items-center">
          <ChiefAvatar size="lg" showBadge className="mb-3" />
          <h2 className="font-bold text-gray-900 text-lg">Chief Assistant</h2>
          <p className="text-sm text-gray-500">{businessName}</p>
          {needsAttentionCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              {needsAttentionCount} need{needsAttentionCount === 1 ? 's' : ''} attention
            </div>
          )}
        </div>
      </button>

      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex flex-wrap gap-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'needs_attention', label: 'Attention' },
            { key: 'unpaid_deposit', label: 'Unpaid' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as FilterType)}
              className={cn(
                'px-2 py-1 text-xs rounded-full transition-colors',
                filter === f.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">

        {filteredConversations.map((conv) => {
          const lastMessage = conv.messages[conv.messages.length - 1];
          const upcomingBooking = conv.bookings?.find(
            (b) => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date()
          );
          const pendingBooking = conv.bookings?.find((b) => b.depositStatus === 'PENDING');
          const depositIcon = getDepositIcon(upcomingBooking || pendingBooking);

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full p-4 flex items-start gap-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left',
                selectedId === conv.id && 'bg-blue-50'
              )}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {(conv.clientName?.[0] || conv.clientPhone[2] || '?').toUpperCase()}
                  </span>
                </div>
                {conv.unreadCount && conv.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {conv.clientName || formatPhoneNumber(conv.clientPhone)}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDistanceToNow(new Date(conv.lastActivity), { addSuffix: false })}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {lastMessage?.content || 'No messages'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {upcomingBooking && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      📅 {format(new Date(upcomingBooking.startTime), 'MMM d')}
                    </span>
                  )}
                  {depositIcon && (
                    <span className="text-sm" title={depositIcon.label}>
                      {depositIcon.icon}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  );
}
