/**
 * Type preservation tests for OpenAI SDK
 *
 * These tests verify that wrapping the OpenAI client preserves
 * all type information and autocomplete functionality.
 */

import { expectTypeOf, describe, it } from 'vitest';
import OpenAI from 'openai';
import { wrap } from '../wrap';

describe('OpenAI type preservation', () => {
  it('should preserve the client type after wrapping', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);

    // The wrapped client should have all original properties
    expectTypeOf(wrapped.chat).toEqualTypeOf(client.chat);
    expectTypeOf(wrapped.completions).toEqualTypeOf(client.completions);
    expectTypeOf(wrapped.embeddings).toEqualTypeOf(client.embeddings);
    expectTypeOf(wrapped.models).toEqualTypeOf(client.models);
    expectTypeOf(wrapped.files).toEqualTypeOf(client.files);
  });

  it('should preserve nested method types', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);

    // chat.completions.create should have the same signature
    expectTypeOf(wrapped.chat.completions.create).toEqualTypeOf(
      client.chat.completions.create,
    );

    // embeddings.create should have the same signature
    expectTypeOf(wrapped.embeddings.create).toEqualTypeOf(
      client.embeddings.create,
    );

    // models.list should have the same signature
    expectTypeOf(wrapped.models.list).toEqualTypeOf(client.models.list);
  });

  it('should preserve return types of methods', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);

    // Return types should be preserved (wrapped in Promise due to hook support)
    type OriginalCreateReturn = ReturnType<typeof client.chat.completions.create>;
    type WrappedCreateReturn = ReturnType<typeof wrapped.chat.completions.create>;

    // Both should return Promise-like types
    expectTypeOf<WrappedCreateReturn>().toEqualTypeOf<OriginalCreateReturn>();
  });

  it('should preserve parameter types of methods', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);

    // Parameter types should be identical
    type OriginalParams = Parameters<typeof client.chat.completions.create>;
    type WrappedParams = Parameters<typeof wrapped.chat.completions.create>;

    expectTypeOf<WrappedParams>().toEqualTypeOf<OriginalParams>();
  });

  it('should add wrapkit-specific properties', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);

    // Should have wrapkit additions
    expectTypeOf(wrapped.on).toBeFunction();
    expectTypeOf(wrapped.off).toBeFunction();
    expectTypeOf(wrapped.withOptions).toBeFunction();
    expectTypeOf(wrapped.stats).toBeObject();
    expectTypeOf(wrapped.queue).toBeObject();
  });

  it('should preserve types through withOptions', () => {
    const client = new OpenAI({ apiKey: 'test' });
    const wrapped = wrap(client);
    const withPriority = wrapped.withOptions({ priority: 'high' });

    // withOptions should return same client type
    expectTypeOf(withPriority.chat.completions.create).toEqualTypeOf(
      client.chat.completions.create,
    );
  });
});
