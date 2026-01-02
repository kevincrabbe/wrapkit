import { describe, it, expect, vi } from 'vitest';
import { wrap } from './wrap';

interface MockClient {
  doSomething: ReturnType<typeof vi.fn>;
  nested: {
    action: ReturnType<typeof vi.fn>;
  };
}

function createMockClient(): MockClient {
  return {
    doSomething: vi.fn().mockResolvedValue('result'),
    nested: {
      action: vi.fn().mockResolvedValue('nested-result'),
    },
  };
}

describe('hooks', () => {
  describe('before hook', () => {
    it('should call before hook with method name and args', async () => {
      const client = createMockClient();
      const beforeHook = vi.fn();

      const wrapped = wrap(client, {
        hooks: {
          before: beforeHook,
        },
      });

      await wrapped.doSomething('arg1', 'arg2');

      expect(beforeHook).toHaveBeenCalledWith(
        'doSomething',
        ['arg1', 'arg2'],
      );
    });

    it('should call before hook for nested methods', async () => {
      const client = createMockClient();
      const beforeHook = vi.fn();

      const wrapped = wrap(client, {
        hooks: {
          before: beforeHook,
        },
      });

      await wrapped.nested.action('test');

      expect(beforeHook).toHaveBeenCalledWith('nested.action', ['test']);
    });

    it('should allow modifying args in before hook', async () => {
      const client = createMockClient();

      const wrapped = wrap(client, {
        hooks: {
          before: () => ['modified-arg'],
        },
      });

      await wrapped.doSomething('original-arg');

      expect(client.doSomething).toHaveBeenCalledWith('modified-arg');
    });
  });

  describe('after hook', () => {
    it('should call after hook with method name and result', async () => {
      const client = createMockClient();
      const afterHook = vi.fn();

      const wrapped = wrap(client, {
        hooks: {
          after: afterHook,
        },
      });

      await wrapped.doSomething();

      expect(afterHook).toHaveBeenCalledWith('doSomething', 'result');
    });

    it('should allow transforming result in after hook', async () => {
      const client = createMockClient();

      const wrapped = wrap(client, {
        hooks: {
          after: () => 'transformed-result',
        },
      });

      const result = await wrapped.doSomething();

      expect(result).toBe('transformed-result');
    });
  });

  describe('onError hook', () => {
    it('should call onError hook when method throws', async () => {
      const client = createMockClient();
      const error = new Error('test error');
      client.doSomething.mockRejectedValue(error);
      const onErrorHook = vi.fn().mockImplementation(() => {
        throw error;
      });

      const wrapped = wrap(client, {
        hooks: {
          onError: onErrorHook,
        },
      });

      await expect(wrapped.doSomething()).rejects.toThrow('test error');
      expect(onErrorHook).toHaveBeenCalled();
    });

    it('should allow returning fallback value from onError', async () => {
      const client = createMockClient();
      client.doSomething.mockRejectedValue(new Error('test error'));

      const wrapped = wrap(client, {
        hooks: {
          onError: () => 'fallback-value',
        },
      });

      const result = await wrapped.doSomething();

      expect(result).toBe('fallback-value');
    });
  });

  describe('hook execution order', () => {
    it('should execute hooks in order: before -> method -> after', async () => {
      const client = createMockClient();
      const order: string[] = [];

      client.doSomething.mockImplementation(() => {
        order.push('method');
        return Promise.resolve('result');
      });

      const wrapped = wrap(client, {
        hooks: {
          before: () => {
            order.push('before');
            return undefined;
          },
          after: () => {
            order.push('after');
            return undefined;
          },
        },
      });

      await wrapped.doSomething();

      expect(order).toEqual(['before', 'method', 'after']);
    });
  });
});
