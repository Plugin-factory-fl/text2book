'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  createdAt: string;
  isAi?: boolean;
}

interface SmsThreadProps {
  messages: Message[];
  clientName: string | null;
  clientPhone: string;
  onSendMessage?: (message: string) => Promise<void>;
  onTakeOver?: () => void;
  isAiActive?: boolean;
}

export function SmsThread({
  messages,
  clientName,
  clientPhone,
  onSendMessage,
  onTakeOver,
  isAiActive = true,
}: SmsThreadProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !onSendMessage) return;

    setIsSending(true);
    try {
      await onSendMessage(input.trim());
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">
            {clientName || formatPhoneNumber(clientPhone)}
          </h2>
          <p className="text-sm text-gray-500">{formatPhoneNumber(clientPhone)}</p>
        </div>
        {isAiActive && onTakeOver && (
          <button
            onClick={onTakeOver}
            className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
          >
            Take over from AI
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.direction === 'OUTBOUND'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={cn(
                  'text-xs mt-1',
                  message.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-gray-400'
                )}
              >
                {format(new Date(message.createdAt), 'h:mm a')}
                {message.direction === 'OUTBOUND' && message.isAi !== false && (
                  <span className="ml-1">· AI</span>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        {isAiActive && (
          <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            AI is handling this conversation
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
