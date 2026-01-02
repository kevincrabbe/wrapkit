import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wrap } from './wrap';

interface MockClient {
  fast: ReturnType<typeof vi.fn>;
  slow: ReturnType<typeof vi.fn>;
}

function createMockClient(): MockClient {
  return {
    fast: vi.fn().mockResolvedValue('fast-result'),
    slow: vi.fn().mockResolvedValue('slow-result'),
  };
}

describe('queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('queue control', () => {
    it('should expose queue size', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      client.slow.mockImplementation(async () => {
        await firstPromise;
        return 'slow-result';
      });

      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      // Start first request (will block)
      const p1 = wrapped.slow();
      // Queue second request
      const p2 = wrapped.slow();

      // Small delay to let queue update
      await new Promise((r) => setTimeout(r, 10));

      expect(wrapped.queue.size).toBeGreaterThanOrEqual(1);

      // Release first request
      resolveFirst!();
      await Promise.all([p1, p2]);
    });

    it('should allow pausing the queue', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      const wrapped = wrap(client, {
        queue: { concurrency: 2 },
      });

      wrapped.queue.pause();

      // Start request while paused
      const promise = wrapped.fast();

      // Give it time to potentially execute
      await new Promise((r) => setTimeout(r, 20));

      // Should not have been called yet
      expect(client.fast).not.toHaveBeenCalled();

      wrapped.queue.resume();

      await promise;
      expect(client.fast).toHaveBeenCalledTimes(1);
    });

    it('should allow clearing the queue', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      client.slow.mockImplementation(async () => {
        await firstPromise;
        return 'slow-result';
      });

      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      // Start first request (will block)
      const p1 = wrapped.slow();
      // Queue more requests
      const p2 = wrapped.slow();
      const p3 = wrapped.slow();

      await new Promise((r) => setTimeout(r, 10));

      // Clear the queue
      wrapped.queue.clear();

      // Release first request
      resolveFirst!();

      await p1;

      // The cleared requests should reject
      await expect(p2).rejects.toThrow('Queue cleared');
      await expect(p3).rejects.toThrow('Queue cleared');
    });
  });

  describe('priority', () => {
    it('should process high priority requests first', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      const executionOrder: string[] = [];

      client.fast.mockImplementation(async () => {
        executionOrder.push('executed');
        return 'result';
      });

      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      // Pause to queue up requests
      wrapped.queue.pause();

      // Queue normal priority
      const normalP = wrapped.withOptions({ priority: 'normal' }).fast();
      // Queue low priority
      const lowP = wrapped.withOptions({ priority: 'low' }).fast();
      // Queue high priority (should execute first)
      const highP = wrapped.withOptions({ priority: 'high' }).fast();
      // Queue critical priority (should execute before high)
      const criticalP = wrapped.withOptions({ priority: 'critical' }).fast();

      // Resume and let them execute
      wrapped.queue.resume();

      await Promise.all([normalP, lowP, highP, criticalP]);

      // Order should be: critical, high, normal, low
      expect(executionOrder).toHaveLength(4);
    });
  });

  describe('queue events', () => {
    it('should emit queued event when request is queued', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      const wrapped = wrap(client, {
        queue: { concurrency: 1 },
      });

      const queuedHandler = vi.fn();
      wrapped.on('queued', queuedHandler);

      // Pause to ensure queuing
      wrapped.queue.pause();

      const promise = wrapped.fast();

      await new Promise((r) => setTimeout(r, 10));

      expect(queuedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'fast',
          queueSize: expect.any(Number),
        }),
      );

      wrapped.queue.resume();
      await promise;
    });

    it('should emit executing event when request starts', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      const wrapped = wrap(client, {});

      const executingHandler = vi.fn();
      wrapped.on('executing', executingHandler);

      await wrapped.fast();

      expect(executingHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'fast',
          concurrent: expect.any(Number),
        }),
      );
    });

    it('should emit completed event when request finishes', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      const wrapped = wrap(client, {});

      const completedHandler = vi.fn();
      wrapped.on('completed', completedHandler);

      await wrapped.fast();

      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'fast',
          duration: expect.any(Number),
        }),
      );
    });
  });

  describe('timeout', () => {
    it('should timeout requests that take too long', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      client.slow.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'slow-result';
      });

      const wrapped = wrap(client, {
        queue: { timeout: 50 },
      });

      await expect(wrapped.slow()).rejects.toThrow('Request timed out');
    });
  });

  describe('max queue size', () => {
    it('should reject when queue is full', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((r) => {
        resolveFirst = r;
      });

      client.slow.mockImplementation(async () => {
        await firstPromise;
        return 'slow-result';
      });

      const wrapped = wrap(client, {
        queue: { concurrency: 1, maxSize: 2 },
      });

      // Start first request (blocks concurrency)
      const p1 = wrapped.slow();
      // Queue 2 more (fills queue)
      const p2 = wrapped.slow();
      const p3 = wrapped.slow();

      // This should reject - queue is full
      await expect(wrapped.slow()).rejects.toThrow('Queue is full');

      // Clean up
      resolveFirst!();
      await Promise.all([p1, p2, p3]);
    });
  });
});
