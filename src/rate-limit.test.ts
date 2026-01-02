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

describe('rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestsPerSecond', () => {
    it('should allow requests under the rate limit', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: { requestsPerSecond: 10 },
      });

      // 10 requests should all go through immediately
      const promises = Array.from({ length: 10 }, () => wrapped.fast());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(client.fast).toHaveBeenCalledTimes(10);
    });

    it('should delay requests that exceed the rate limit', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: { requestsPerSecond: 2 },
      });

      // Fire 4 requests - first 2 should be immediate, next 2 delayed
      const promises = [
        wrapped.fast(),
        wrapped.fast(),
        wrapped.fast(),
        wrapped.fast(),
      ];

      // First 2 should complete immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(client.fast).toHaveBeenCalledTimes(2);

      // After 500ms, 3rd should execute (1 second / 2 rps = 500ms window refill)
      await vi.advanceTimersByTimeAsync(500);
      expect(client.fast).toHaveBeenCalledTimes(3);

      // After another 500ms, 4th should execute
      await vi.advanceTimersByTimeAsync(500);
      expect(client.fast).toHaveBeenCalledTimes(4);

      await Promise.all(promises);
    });

    it('should emit rateLimited event when requests are delayed', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: { requestsPerSecond: 1 },
      });

      const rateLimitedHandler = vi.fn();
      wrapped.on('rateLimited', rateLimitedHandler);

      // Fire 2 requests - first immediate, second rate limited
      const promise1 = wrapped.fast();
      const promise2 = wrapped.fast();

      await vi.advanceTimersByTimeAsync(0);
      expect(rateLimitedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'fast',
          retryAfter: expect.any(Number),
        }),
      );

      await vi.advanceTimersByTimeAsync(1000);
      await Promise.all([promise1, promise2]);
    });
  });

  describe('requestsPerMinute', () => {
    it('should support requestsPerMinute configuration', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: { requestsPerMinute: 60 },
      });

      // 60 per minute = 1 per second
      const promises = [wrapped.fast(), wrapped.fast()];

      await vi.advanceTimersByTimeAsync(0);
      expect(client.fast).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(client.fast).toHaveBeenCalledTimes(2);

      await Promise.all(promises);
    });
  });

  describe('concurrency', () => {
    it('should limit concurrent requests', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      client.slow.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrentCalls--;
        return 'slow-result';
      });

      const wrapped = wrap(client, {
        rateLimit: { concurrency: 2, requestsPerSecond: 1000 },
      });

      // Fire 4 requests
      const promises = Array.from({ length: 4 }, () => wrapped.slow());
      await Promise.all(promises);

      expect(maxConcurrent).toBe(2);
      expect(client.slow).toHaveBeenCalledTimes(4);
    });
  });

  describe('per-method rate limits', () => {
    it('should support different limits for different methods', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: {
          default: { requestsPerSecond: 10 },
          perMethod: {
            slow: { requestsPerSecond: 1 },
          },
        },
      });

      // fast should allow many requests
      const fastPromises = Array.from({ length: 5 }, () => wrapped.fast());
      await vi.advanceTimersByTimeAsync(0);
      expect(client.fast).toHaveBeenCalledTimes(5);

      // slow should be rate limited to 1/sec
      const slowPromises = [wrapped.slow(), wrapped.slow()];
      await vi.advanceTimersByTimeAsync(0);
      expect(client.slow).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(client.slow).toHaveBeenCalledTimes(2);

      await Promise.all([...fastPromises, ...slowPromises]);
    });
  });

  describe('stats tracking', () => {
    it('should track requestsPerMinute in stats', async () => {
      const client = createMockClient();
      const wrapped = wrap(client, {
        rateLimit: { requestsPerSecond: 100 },
      });

      expect(wrapped.stats.requestsPerMinute).toBe(0);

      await wrapped.fast();
      await wrapped.fast();
      await wrapped.fast();

      // Stats should reflect recent requests
      expect(wrapped.stats.totalRequests).toBe(3);
    });

    it('should track average latency in stats', async () => {
      vi.useRealTimers();

      const client = createMockClient();
      client.slow.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'slow-result';
      });

      const wrapped = wrap(client, {});

      await wrapped.slow();

      expect(wrapped.stats.averageLatency).toBeGreaterThan(0);
    });
  });
});
