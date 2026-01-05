import { describe, it, expect, vi } from 'vitest';
import OpenAI from 'openai';
import { wrap } from './wrap';

const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API_KEY;
const hasApiKey = !!apiKey;

describe.skipIf(!hasApiKey)('OpenAI integration', () => {
  it('should wrap OpenAI client and make real API call', async () => {
    const client = new OpenAI({ apiKey });
    const wrapped = wrap(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "test" and nothing else' }],
      max_tokens: 5,
    });

    expect(result.choices[0].message.content).toBeDefined();
  });

  it('should execute before hook with real client', async () => {
    const beforeHook = vi.fn();
    const client = new OpenAI({ apiKey });
    const wrapped = wrap(client, { hooks: { before: beforeHook } });

    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "hi"' }],
      max_tokens: 5,
    });

    expect(beforeHook).toHaveBeenCalledTimes(1);
    expect(beforeHook).toHaveBeenCalledWith(
      'chat.completions.create',
      [expect.objectContaining({ model: 'gpt-4o-mini' })],
    );
  });

  it('should execute after hook with real response', async () => {
    const afterHook = vi.fn();
    const client = new OpenAI({ apiKey });
    const wrapped = wrap(client, { hooks: { after: afterHook } });

    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "hello"' }],
      max_tokens: 5,
    });

    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(afterHook).toHaveBeenCalledWith(
      'chat.completions.create',
      expect.objectContaining({
        choices: expect.any(Array),
      }),
    );
  });
});
