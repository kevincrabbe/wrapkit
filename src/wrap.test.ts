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

  describe('withOptions()', () => {
    it('should allow setting timeout per call', async () => {
      const client = createMockClient();
      client.chat.completions.create.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ id: 'slow' });
            }, 100);
          }),
      );

      const wrapped = wrap(client);

      await expect(
        wrapped.withOptions({ timeout: 10 }).chat.completions.create({}),
      ).rejects.toThrow("Method 'chat.completions.create' timed out after 10ms");
    });

    it('should not timeout if request completes in time', async () => {
      const client = createMockClient();
      client.chat.completions.create.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ id: 'fast' });
            }, 10);
          }),
      );

      const wrapped = wrap(client);
      const result = await wrapped.withOptions({ timeout: 100 }).chat.completions.create({});

      expect(result).toEqual({ id: 'fast' });
    });

    it('should allow skipping the queue with skipQueue option', async () => {
      const client = createMockClient();
      const executionOrder: string[] = [];

      client.chat.completions.create.mockImplementation(async () => {
        executionOrder.push('executed');
        return { id: 'result' };
      });

      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      // Pause the queue
      wrapped.queue.pause();

      // This should be queued and wait
      const queuedPromise = wrapped.chat.completions.create({});

      // This should skip the queue and execute immediately
      const skippedPromise = wrapped
        .withOptions({ skipQueue: true })
        .chat.completions.create({});

      // Wait a bit for the skipped call to execute
      await skippedPromise;

      expect(executionOrder).toEqual(['executed']);

      // Resume and let queued call complete
      wrapped.queue.resume();
      await queuedPromise;

      expect(executionOrder).toEqual(['executed', 'executed']);
    });

    it('should allow combining priority with other options', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      const result = await wrapped
        .withOptions({ priority: 'high', timeout: 5000 })
        .chat.completions.create({});

      expect(result).toEqual({ id: 'test-completion' });
    });
  });
});
