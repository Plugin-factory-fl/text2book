import { OPENAI_LIMITS, trimConversationHistory } from '../src/lib/openai';

describe('OpenAI config', () => {
  const originalClient = process.env.OPENAI_MODEL_CLIENT;
  const originalOwner = process.env.OPENAI_MODEL_OWNER;

  afterEach(() => {
    if (originalClient === undefined) delete process.env.OPENAI_MODEL_CLIENT;
    else process.env.OPENAI_MODEL_CLIENT = originalClient;
    if (originalOwner === undefined) delete process.env.OPENAI_MODEL_OWNER;
    else process.env.OPENAI_MODEL_OWNER = originalOwner;
    jest.resetModules();
  });

  it('defaults to cheaper client and owner models', () => {
    delete process.env.OPENAI_MODEL_CLIENT;
    delete process.env.OPENAI_MODEL_OWNER;
    jest.resetModules();
    const config = require('../src/lib/openai');
    expect(config.OPENAI_MODEL_CLIENT).toBe('gpt-4.1-nano');
    expect(config.OPENAI_MODEL_OWNER).toBe('gpt-4.1-mini');
  });

  it('reads model overrides from env', () => {
    process.env.OPENAI_MODEL_CLIENT = 'gpt-test-client';
    process.env.OPENAI_MODEL_OWNER = 'gpt-test-owner';
    jest.resetModules();
    const config = require('../src/lib/openai');
    expect(config.OPENAI_MODEL_CLIENT).toBe('gpt-test-client');
    expect(config.OPENAI_MODEL_OWNER).toBe('gpt-test-owner');
  });

  it('keeps SMS token and temperature limits tight', () => {
    expect(OPENAI_LIMITS.smsMaxTokens).toBeLessThanOrEqual(300);
    expect(OPENAI_LIMITS.smsTemperature).toBeLessThanOrEqual(0.3);
    expect(OPENAI_LIMITS.historyWindow).toBe(12);
  });

  it('trims history to the last 12 messages plus a summary', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));

    const result = trimConversationHistory(messages, 12);
    expect(result.recent).toHaveLength(12);
    expect(result.recent[0].content).toBe('message 8');
    expect(result.summary).toContain('Earlier conversation summary');
    expect(result.summary).toContain('message 0');
  });
});
