import { describe, it, expect, vi } from 'vitest';
import { wrap } from './wrap';

interface DeepMockClient {
  chat: {
    completions: {
      create: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
    };
  };
  embeddings: {
    create: ReturnType<typeof vi.fn>;
  };
  files: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  models: {
    list: ReturnType<typeof vi.fn>;
  };
}

function createDeepMockClient(): DeepMockClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue('chat-completion'),
        list: vi.fn().mockResolvedValue('chat-list'),
      },
    },
    embeddings: {
      create: vi.fn().mockResolvedValue('embedding'),
    },
    files: {
      create: vi.fn().mockResolvedValue('file-created'),
      delete: vi.fn().mockResolvedValue('file-deleted'),
      list: vi.fn().mockResolvedValue('files-list'),
    },
    models: {
      list: vi.fn().mockResolvedValue('models-list'),
    },
  };
}

describe('access control', () => {
  describe('allowlist', () => {
    it('should allow exact method match', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['chat.completions.create'],
      });

      const result = await wrapped.chat.completions.create({});
      expect(result).toBe('chat-completion');
    });

    it('should block methods not in allowlist', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['chat.completions.create'],
      });

      await expect(wrapped.models.list()).rejects.toThrow(
        'Method "models.list" is not allowed',
      );
    });

    it('should support shallow glob (*) - matches single segment', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['files.*'],
      });

      // files.create, files.delete, files.list should all work
      await expect(wrapped.files.create({})).resolves.toBe('file-created');
      await expect(wrapped.files.delete({})).resolves.toBe('file-deleted');
      await expect(wrapped.files.list()).resolves.toBe('files-list');

      // But deeper paths should not match
      await expect(wrapped.chat.completions.create({})).rejects.toThrow(
        'Method "chat.completions.create" is not allowed',
      );
    });

    it('should support deep glob (**) - matches multiple segments', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['chat.**'],
      });

      // chat.completions.create and chat.completions.list should work
      await expect(wrapped.chat.completions.create({})).resolves.toBe(
        'chat-completion',
      );
      await expect(wrapped.chat.completions.list()).resolves.toBe('chat-list');

      // But other top-level methods should not
      await expect(wrapped.models.list()).rejects.toThrow(
        'Method "models.list" is not allowed',
      );
    });

    it('should support trailing glob for method names (*.create)', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['*.create'],
      });

      // embeddings.create and files.create should work (single segment before .create)
      await expect(wrapped.embeddings.create({})).resolves.toBe('embedding');
      await expect(wrapped.files.create({})).resolves.toBe('file-created');

      // But chat.completions.create should NOT match (two segments before .create)
      await expect(wrapped.chat.completions.create({})).rejects.toThrow(
        'Method "chat.completions.create" is not allowed',
      );
    });

    it('should support deep trailing glob (**.create)', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['**.create'],
      });

      // All .create methods at any depth should work
      await expect(wrapped.chat.completions.create({})).resolves.toBe(
        'chat-completion',
      );
      await expect(wrapped.embeddings.create({})).resolves.toBe('embedding');
      await expect(wrapped.files.create({})).resolves.toBe('file-created');

      // But .list and .delete should not
      await expect(wrapped.models.list()).rejects.toThrow(
        'Method "models.list" is not allowed',
      );
      await expect(wrapped.files.delete({})).rejects.toThrow(
        'Method "files.delete" is not allowed',
      );
    });

    it('should support multiple allowlist entries', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        allowlist: ['chat.completions.create', 'models.list'],
      });

      await expect(wrapped.chat.completions.create({})).resolves.toBe(
        'chat-completion',
      );
      await expect(wrapped.models.list()).resolves.toBe('models-list');
      await expect(wrapped.files.create({})).rejects.toThrow(
        'Method "files.create" is not allowed',
      );
    });
  });

  describe('blocklist', () => {
    it('should block exact method match', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        blocklist: ['files.delete'],
      });

      await expect(wrapped.files.delete({})).rejects.toThrow(
        'Method "files.delete" is blocked',
      );
    });

    it('should allow methods not in blocklist', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        blocklist: ['files.delete'],
      });

      const result = await wrapped.chat.completions.create({});
      expect(result).toBe('chat-completion');
    });

    it('should support shallow glob (*)', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        blocklist: ['files.*'],
      });

      // All files.* methods should be blocked
      await expect(wrapped.files.create({})).rejects.toThrow(
        'Method "files.create" is blocked',
      );
      await expect(wrapped.files.delete({})).rejects.toThrow(
        'Method "files.delete" is blocked',
      );

      // But other methods should work
      await expect(wrapped.chat.completions.create({})).resolves.toBe(
        'chat-completion',
      );
    });

    it('should support deep glob (**)', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        blocklist: ['chat.**'],
      });

      // All chat.** methods should be blocked
      await expect(wrapped.chat.completions.create({})).rejects.toThrow(
        'Method "chat.completions.create" is blocked',
      );
      await expect(wrapped.chat.completions.list()).rejects.toThrow(
        'Method "chat.completions.list" is blocked',
      );

      // But other methods should work
      await expect(wrapped.models.list()).resolves.toBe('models-list');
    });

    it('should support multiple blocklist entries', async () => {
      const client = createDeepMockClient();
      const wrapped = wrap(client, {
        blocklist: ['files.delete', 'chat.**'],
      });

      await expect(wrapped.files.delete({})).rejects.toThrow(
        'Method "files.delete" is blocked',
      );
      await expect(wrapped.chat.completions.create({})).rejects.toThrow(
        'Method "chat.completions.create" is blocked',
      );

      // Other methods should work
      await expect(wrapped.files.create({})).resolves.toBe('file-created');
      await expect(wrapped.models.list()).resolves.toBe('models-list');
    });
  });

  describe('mutual exclusivity', () => {
    it('should throw if both allowlist and blocklist are provided', () => {
      const client = createDeepMockClient();

      expect(() =>
        wrap(client, {
          allowlist: ['chat.**'],
          blocklist: ['files.delete'],
        }),
      ).toThrow('Cannot specify both allowlist and blocklist');
    });
  });
});
