import { describe, it, expect, vi } from 'vitest';
import { wrap } from './wrap';
import { definePlugin } from './plugin';
import type { Plugin } from './types';

interface MockClient {
  doSomething: (value: string) => Promise<string>;
  nested: {
    action: (n: number) => Promise<number>;
  };
  failing: () => Promise<never>;
}

function createMockClient(): MockClient {
  return {
    doSomething: vi.fn(async (value: string) => `result:${value}`),
    nested: {
      action: vi.fn(async (n: number) => n * 2),
    },
    failing: vi.fn(async () => {
      throw new Error('intentional error');
    }),
  };
}

describe('plugin system', () => {
  describe('.use() method', () => {
    it('should have a use method on wrapped client', () => {
      const client = createMockClient();
      const wrapped = wrap(client);

      expect(typeof wrapped.use).toBe('function');
    });

    it('should return a wrapped client after use()', () => {
      const client = createMockClient();
      const plugin = definePlugin({ name: 'test' });
      const wrapped = wrap(client).use(plugin);

      expect(typeof wrapped.doSomething).toBe('function');
      expect(typeof wrapped.use).toBe('function');
    });

    it('should allow chaining multiple plugins', () => {
      const client = createMockClient();
      const plugin1 = definePlugin({ name: 'plugin1' });
      const plugin2 = definePlugin({ name: 'plugin2' });
      const plugin3 = definePlugin({ name: 'plugin3' });

      const wrapped = wrap(client).use(plugin1).use(plugin2).use(plugin3);

      expect(typeof wrapped.doSomething).toBe('function');
    });
  });

  describe('before hook', () => {
    it('should call plugin before hook', async () => {
      const client = createMockClient();
      const beforeSpy = vi.fn();
      const plugin = definePlugin({
        name: 'test',
        before: beforeSpy,
      });

      const wrapped = wrap(client).use(plugin);
      await wrapped.doSomething('test');

      expect(beforeSpy).toHaveBeenCalledWith({
        method: 'doSomething',
        args: ['test'],
      });
    });

    it('should call multiple before hooks in order', async () => {
      const client = createMockClient();
      const order: number[] = [];

      const plugin1 = definePlugin({
        name: 'plugin1',
        before: () => {
          order.push(1);
        },
      });
      const plugin2 = definePlugin({
        name: 'plugin2',
        before: () => {
          order.push(2);
        },
      });
      const plugin3 = definePlugin({
        name: 'plugin3',
        before: () => {
          order.push(3);
        },
      });

      const wrapped = wrap(client).use(plugin1).use(plugin2).use(plugin3);
      await wrapped.doSomething('test');

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('after hook', () => {
    it('should call plugin after hook with result', async () => {
      const client = createMockClient();
      const afterSpy = vi.fn();
      const plugin = definePlugin({
        name: 'test',
        after: afterSpy,
      });

      const wrapped = wrap(client).use(plugin);
      await wrapped.doSomething('test');

      expect(afterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'doSomething',
          args: ['test'],
          result: 'result:test',
        }),
      );
    });

    it('should call multiple after hooks in reverse order (onion model)', async () => {
      const client = createMockClient();
      const order: number[] = [];

      const plugin1 = definePlugin({
        name: 'plugin1',
        after: () => {
          order.push(1);
        },
      });
      const plugin2 = definePlugin({
        name: 'plugin2',
        after: () => {
          order.push(2);
        },
      });
      const plugin3 = definePlugin({
        name: 'plugin3',
        after: () => {
          order.push(3);
        },
      });

      const wrapped = wrap(client).use(plugin1).use(plugin2).use(plugin3);
      await wrapped.doSomething('test');

      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('context passing', () => {
    it('should pass context from before to after hook', async () => {
      const client = createMockClient();
      let receivedContext: unknown;

      interface TimingContext {
        startTime: number;
      }

      const plugin: Plugin<TimingContext> = {
        name: 'timing',
        before: () => ({ startTime: 12345 }),
        after: ({ context }) => {
          receivedContext = context;
        },
      };

      const wrapped = wrap(client).use(plugin);
      await wrapped.doSomething('test');

      expect(receivedContext).toEqual({ startTime: 12345 });
    });

    it('should pass context from before to onError hook', async () => {
      const client = createMockClient();
      let receivedContext: unknown;

      interface DebugContext {
        attempt: number;
      }

      const plugin: Plugin<DebugContext> = {
        name: 'debug',
        before: () => ({ attempt: 1 }),
        onError: ({ context }) => {
          receivedContext = context;
        },
      };

      const wrapped = wrap(client).use(plugin);

      await expect(wrapped.failing()).rejects.toThrow('intentional error');
      expect(receivedContext).toEqual({ attempt: 1 });
    });
  });

  describe('onError hook', () => {
    it('should call plugin onError hook on failure', async () => {
      const client = createMockClient();
      const onErrorSpy = vi.fn();
      const plugin = definePlugin({
        name: 'test',
        onError: onErrorSpy,
      });

      const wrapped = wrap(client).use(plugin);

      await expect(wrapped.failing()).rejects.toThrow('intentional error');
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'failing',
          error: expect.any(Error),
        }),
      );
    });

    it('should call multiple onError hooks in reverse order', async () => {
      const client = createMockClient();
      const order: number[] = [];

      const plugin1 = definePlugin({
        name: 'plugin1',
        onError: () => {
          order.push(1);
        },
      });
      const plugin2 = definePlugin({
        name: 'plugin2',
        onError: () => {
          order.push(2);
        },
      });
      const plugin3 = definePlugin({
        name: 'plugin3',
        onError: () => {
          order.push(3);
        },
      });

      const wrapped = wrap(client).use(plugin1).use(plugin2).use(plugin3);

      await expect(wrapped.failing()).rejects.toThrow();
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('combining with config hooks', () => {
    it('should run config hooks before plugins', async () => {
      const client = createMockClient();
      const order: string[] = [];

      const plugin = definePlugin({
        name: 'test',
        before: () => {
          order.push('plugin-before');
        },
        after: () => {
          order.push('plugin-after');
        },
      });

      const wrapped = wrap(client, {
        hooks: {
          before: () => {
            order.push('config-before');
            return undefined;
          },
          after: () => {
            order.push('config-after');
            return undefined;
          },
        },
      }).use(plugin);

      await wrapped.doSomething('test');

      expect(order).toEqual([
        'config-before',
        'plugin-before',
        'plugin-after',
        'config-after',
      ]);
    });
  });

  describe('type preservation', () => {
    it('should preserve client type after use()', async () => {
      const client = createMockClient();
      const plugin = definePlugin({ name: 'test' });

      const wrapped = wrap(client).use(plugin);

      const result = await wrapped.doSomething('hello');
      expect(result).toBe('result:hello');

      const nestedResult = await wrapped.nested.action(5);
      expect(nestedResult).toBe(10);
    });
  });
});
