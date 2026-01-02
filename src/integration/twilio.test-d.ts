/**
 * Type preservation tests for Twilio SDK
 *
 * These tests verify that wrapping the Twilio client preserves
 * all type information and autocomplete functionality.
 */

import { expectTypeOf, describe, it } from 'vitest';
import Twilio from 'twilio';
import { wrap } from '../wrap';

describe('Twilio type preservation', () => {
  it('should preserve the client type after wrapping', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);

    // The wrapped client should have all original properties
    expectTypeOf(wrapped.messages).toEqualTypeOf(client.messages);
    expectTypeOf(wrapped.calls).toEqualTypeOf(client.calls);
    expectTypeOf(wrapped.accounts).toEqualTypeOf(client.accounts);
  });

  it('should preserve method types on resources', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);

    // messages methods
    expectTypeOf(wrapped.messages.create).toEqualTypeOf(client.messages.create);
    expectTypeOf(wrapped.messages.list).toEqualTypeOf(client.messages.list);

    // calls methods
    expectTypeOf(wrapped.calls.create).toEqualTypeOf(client.calls.create);
    expectTypeOf(wrapped.calls.list).toEqualTypeOf(client.calls.list);
  });

  it('should preserve return types', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);

    type OriginalMessageReturn = ReturnType<typeof client.messages.create>;
    type WrappedMessageReturn = ReturnType<typeof wrapped.messages.create>;

    expectTypeOf<WrappedMessageReturn>().toEqualTypeOf<OriginalMessageReturn>();
  });

  it('should preserve parameter types', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);

    type OriginalParams = Parameters<typeof client.messages.create>;
    type WrappedParams = Parameters<typeof wrapped.messages.create>;

    expectTypeOf<WrappedParams>().toEqualTypeOf<OriginalParams>();
  });

  it('should add wrapkit-specific properties', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);

    expectTypeOf(wrapped.on).toBeFunction();
    expectTypeOf(wrapped.off).toBeFunction();
    expectTypeOf(wrapped.withOptions).toBeFunction();
    expectTypeOf(wrapped.stats).toBeObject();
    expectTypeOf(wrapped.queue).toBeObject();
  });

  it('should preserve types through withOptions', () => {
    const client = Twilio('ACxxx', 'auth_token');
    const wrapped = wrap(client);
    const withPriority = wrapped.withOptions({ priority: 'high' });

    expectTypeOf(withPriority.messages.create).toEqualTypeOf(
      client.messages.create,
    );
    expectTypeOf(withPriority.calls.create).toEqualTypeOf(client.calls.create);
  });
});
