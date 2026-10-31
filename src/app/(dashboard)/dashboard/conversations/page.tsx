'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  clientPhone: string;
  clientName: string | null;
  state: string;
  lastActivity: string;
  messages: Message[];
  bookings: Array<{
    id: string;
    serviceName: string;
    startTime: string;
    status: string;
  }>;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversationDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    fetchConversationDetail(id);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <p className="text-gray-600 mt-1">
          View all text message conversations with clients
        </p>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No conversations yet. When clients text your booking number,
              conversations will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 h-[calc(100vh-16rem)] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0">
              <h2 className="font-semibold text-gray-900">All Conversations</h2>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <div className="divide-y divide-gray-100">
                {conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => handleSelectConversation(convo.id)}
                    className={cn(
                      'w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors',
                      selectedId === convo.id && 'bg-blue-50'
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {convo.clientName || formatPhoneNumber(convo.clientPhone)}
                        </p>
                        {convo.clientName && (
                          <p className="text-xs text-gray-500">
                            {formatPhoneNumber(convo.clientPhone)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {format(new Date(convo.lastActivity), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {convo.messages[0]?.content || 'No messages'}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 h-[calc(100vh-16rem)] overflow-hidden flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="flex-shrink-0 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        {selectedConversation.clientName ||
                          formatPhoneNumber(selectedConversation.clientPhone)}
                      </h2>
                      {selectedConversation.clientName && (
                        <p className="text-sm text-gray-500">
                          {formatPhoneNumber(selectedConversation.clientPhone)}
                        </p>
                      )}
                    </div>
                    {selectedConversation.bookings.length > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Latest Booking</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedConversation.bookings[0].serviceName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(
                            new Date(selectedConversation.bookings[0].startTime),
                            'MMM d, h:mm a'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4">
                  {isLoadingDetail ? (
                    <p className="text-center text-gray-500 py-4">Loading...</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'flex',
                            message.direction === 'OUTBOUND'
                              ? 'justify-end'
                              : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg px-4 py-2',
                              message.direction === 'OUTBOUND'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            )}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={cn(
                                'text-xs mt-1',
                                message.direction === 'OUTBOUND'
                                  ? 'text-blue-200'
                                  : 'text-gray-400'
                              )}
                            >
                              {format(new Date(message.createdAt), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">
                  Select a conversation to view messages
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
