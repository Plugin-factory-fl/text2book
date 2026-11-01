'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChiefAvatar } from './chief-avatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pending?: boolean;
}

interface ClientContext {
  phone: string;
  name?: string;
}

interface AssistantChatProps {
  clientContext?: ClientContext | null;
  onActionComplete?: () => void;
}

const SUGGESTED_PROMPTS = [
  "What's my revenue this month?",
  "Who's booked for tomorrow?",
  "Show unpaid deposits",
  "Add a trusted client",
];

const CLIENT_CONTEXT_PROMPTS = [
  "Show their booking history",
  "Send a reminder",
  "Mark deposit paid",
  "Add to trusted clients",
];

export function AssistantChat({ clientContext, onActionComplete }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your assistant. I can help you manage bookings, check revenue, send messages to clients, update settings, and more. What would you like to do?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (clientContext) {
      setMessages((prev) => [
        ...prev,
        {
          id: `context-${Date.now()}`,
          role: 'assistant',
          content: `Now viewing ${clientContext.name || clientContext.phone}. How can I help with this client?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [clientContext?.phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const pendingMessage: Message = {
      id: `pending-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      pending: true,
    };
    setMessages((prev) => [...prev, pendingMessage]);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages
            .filter((m) => m.id !== 'welcome' && !m.pending)
            .map((m) => ({ role: m.role, content: m.content })),
          clientContext: clientContext || null,
        }),
      });

      const data = await response.json();

      setMessages((prev) =>
        prev
          .filter((m) => !m.pending)
          .concat({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response || 'Sorry, I could not process that request.',
            timestamp: new Date(),
          })
      );

      if (data.functionCalled && onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error('Assistant error:', error);
      setMessages((prev) =>
        prev
          .filter((m) => !m.pending)
          .concat({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
            timestamp: new Date(),
          })
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const prompts = clientContext ? CLIENT_CONTEXT_PROMPTS : SUGGESTED_PROMPTS;

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-50">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <ChiefAvatar size="sm" showBadge={false} className="flex-shrink-0 mt-1" />
            )}
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              )}
            >
              {message.pending ? (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
        {messages.length <= 2 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              clientContext
                ? `Ask about ${clientContext.name || 'this client'}...`
                : 'Ask me anything...'
            }
            disabled={isLoading}
            className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
