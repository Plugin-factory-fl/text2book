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

interface SmsThreadProps {
  messages: Message[];
  clientName: string | null;
  clientPhone: string;
  onSendMessage?: (message: string) => void;
  onTakeOver?: () => void;
  isAiActive?: boolean;
  internalNotes?: InternalNote[];
  showInternalNotes?: boolean;
}

function getNoteTypeLabel(noteType: string): { label: string; color: string; icon: string } {
  const types: Record<string, { label: string; color: string; icon: string }> = {
    CONSULT: { label: 'Consult', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '💬' },
    RESPONSE: { label: 'Response', color: 'bg-green-100 text-green-800 border-green-200', icon: '↩️' },
    ESCALATION: { label: 'Escalation', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '⚠️' },
    DIRECTIVE: { label: 'Directive', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '📋' },
    INJECTION_ATTEMPT: { label: 'Blocked', color: 'bg-red-100 text-red-800 border-red-200', icon: '🛡️' },
  };
  return types[noteType] || { label: noteType, color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '📝' };
}

export function SmsThread({
  messages,
  clientName,
  clientPhone,
  onSendMessage,
  onTakeOver,
  isAiActive = true,
  internalNotes = [],
  showInternalNotes: initialShowNotes = false,
}: SmsThreadProps) {
  const [input, setInput] = useState('');
  const [showInternalNotes, setShowInternalNotes] = useState(initialShowNotes);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !onSendMessage) return;
    onSendMessage(input.trim());
    setInput('');
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
    <div className="h-full min-h-0 flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">
            {clientName || formatPhoneNumber(clientPhone)}
          </h2>
          <p className="text-sm text-gray-500">{formatPhoneNumber(clientPhone)}</p>
        </div>
        <div className="flex items-center gap-2">
          {internalNotes.length > 0 && (
            <button
              onClick={() => setShowInternalNotes(!showInternalNotes)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                showInternalNotes
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {showInternalNotes ? 'Hide' : 'Show'} Internal ({internalNotes.length})
            </button>
          )}
          {isAiActive && onTakeOver && (
            <button
              onClick={onTakeOver}
              className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              Take over from AI
            </button>
          )}
        </div>
      </div>

      {/* Internal Notes Panel */}
      {showInternalNotes && internalNotes.length > 0 && (
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 max-h-48 overflow-y-auto">
          <h3 className="text-xs font-semibold text-indigo-800 mb-2 flex items-center gap-1">
            🔒 Internal Notes (not sent to client)
          </h3>
          <div className="space-y-2">
            {internalNotes.map((note) => {
              const typeInfo = getNoteTypeLabel(note.noteType);
              return (
                <div
                  key={note.id}
                  className={cn('p-2 rounded-lg border text-xs', typeInfo.color)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium flex items-center gap-1">
                      {typeInfo.icon} {typeInfo.label}
                      {note.wasFiltered && (
                        <span className="text-red-600">(filtered)</span>
                      )}
                    </span>
                    <span className="opacity-75">
                      {format(new Date(note.createdAt), 'h:mm a')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  {note.filterReason && (
                    <p className="mt-1 text-red-600 italic">Reason: {note.filterReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
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

      <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
        {isAiActive && (
          <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            AI is handling this conversation
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 min-w-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
