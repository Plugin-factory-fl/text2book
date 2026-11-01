import OpenAI from 'openai';

export const OPENAI_MODEL_CLIENT = process.env.OPENAI_MODEL_CLIENT || 'gpt-4.1-nano';
export const OPENAI_MODEL_OWNER = process.env.OPENAI_MODEL_OWNER || 'gpt-4.1-mini';

export const OPENAI_LIMITS = {
  smsMaxTokens: 300,
  ownerMaxTokens: 400,
  extractMaxTokens: 700,
  smsTemperature: 0.3,
  ownerTemperature: 0.3,
  extractTemperature: 0.1,
  historyWindow: 12,
  summaryMaxChars: 400,
};

export function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function requireOpenAIClient(): OpenAI {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return client;
}

export interface ChatTurn {
  role: string;
  content: string;
}

export function trimConversationHistory<T extends ChatTurn>(
  messages: T[],
  window = OPENAI_LIMITS.historyWindow
): { summary?: string; recent: T[] } {
  if (messages.length <= window) {
    return { recent: messages };
  }

  const older = messages.slice(0, -window);
  const recent = messages.slice(-window);
  const summary = older
    .map((message) => `${message.role}: ${String(message.content || '').replace(/\s+/g, ' ').slice(0, 80)}`)
    .join(' | ')
    .slice(0, OPENAI_LIMITS.summaryMaxChars);

  return {
    summary: `Earlier conversation summary: ${summary}`,
    recent,
  };
}
