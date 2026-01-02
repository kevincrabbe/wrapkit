import { describe, it, expect, vi } from 'vitest';
import { wrap } from './wrap';

interface MockClient {
  chat: {
    completions: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  models: {
    list: ReturnType<typeof vi.fn>;
  };
  syncMethod: ReturnType<typeof vi.fn>;
}

/**
 * Mock client for testing - simulates an API client like OpenAI
 */
function createMockClient(): MockClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ id: 'test-completion' }),
      },
    },
    models: {
      list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4' }] }),
    },
    syncMethod: vi.fn().mockReturnValue('sync-result'),
  };
}

describe('wrap()', () => {
  describe('core functionality', () => {
    it('should return a wrapped client that preserves original methods', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(wrapped.chat).toBeDefined();
      expect(wrapped.chat.completions).toBeDefined();
      expect(wrapped.chat.completions.create).toBeDefined();
      expect(wrapped.models.list).toBeDefined();
    });

    it('should call through to the original method', async () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      const result = await wrapped.chat.completions.create({ model: 'gpt-4' });

      expect(client.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
      });
      expect(result).toEqual({ id: 'test-completion' });
    });

    it('should work with nested method paths', async () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      await wrapped.chat.completions.create({ model: 'gpt-4' });
      await wrapped.models.list();

      expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(client.models.list).toHaveBeenCalledTimes(1);
    });

    it('should work with synchronous methods', async () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      // Note: wrapped methods return Promises due to hook support
      const result = await wrapped.syncMethod();

      expect(client.syncMethod).toHaveBeenCalled();
      expect(result).toBe('sync-result');
    });

    it('should preserve the return value from the original method', async () => {
      const client = createMockClient();
      const expectedResult = { data: [{ id: 'model-1' }, { id: 'model-2' }] };
      client.models.list.mockResolvedValue(expectedResult);

      const wrapped = wrap(client);
      const result = await wrapped.models.list();

      expect(result).toEqual(expectedResult);
    });
  });

  describe('configuration validation', () => {
    it('should throw if both allowlist and blocklist are provided', () => {
      const client = createMockClient();

      expect(() =>
        wrap(client, {
          allowlist: ['chat.completions.create'],
          blocklist: ['models.list'],
        }),
      ).toThrow('Cannot specify both allowlist and blocklist');
    });

    it('should accept config with only allowlist', () => {
      const client = createMockClient();

      expect(() =>
        wrap(client, {
          allowlist: ['chat.completions.create'],
        }),
      ).not.toThrow();
    });

    it('should accept config with only blocklist', () => {
      const client = createMockClient();

      expect(() =>
        wrap(client, {
          blocklist: ['models.list'],
        }),
      ).not.toThrow();
    });

    it('should accept empty config', () => {
      const client = createMockClient();

      expect(() => wrap(client, {})).not.toThrow();
    });

    it('should accept no config', () => {
      const client = createMockClient();

      expect(() => wrap(client)).not.toThrow();
    });
  });

  describe('wrapper properties', () => {
    it('should have an on() method for events', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(typeof wrapped.on).toBe('function');
    });

    it('should have an off() method for events', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(typeof wrapped.off).toBe('function');
    });

    it('should have a withOptions() method', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(typeof wrapped.withOptions).toBe('function');
    });

    it('should have a stats object', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(wrapped.stats).toBeDefined();
      expect(typeof wrapped.stats.requestsPerMinute).toBe('number');
      expect(typeof wrapped.stats.averageLatency).toBe('number');
    });

    it('should have a queue control object', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(wrapped.queue).toBeDefined();
      expect(typeof wrapped.queue.size).toBe('number');
      expect(typeof wrapped.queue.pause).toBe('function');
      expect(typeof wrapped.queue.resume).toBe('function');
    });
  });
});
