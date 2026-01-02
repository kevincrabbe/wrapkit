/**
 * Type preservation tests for Stripe SDK
 *
 * These tests verify that wrapping the Stripe client preserves
 * all type information and autocomplete functionality.
 */

import { expectTypeOf, describe, it } from 'vitest';
import Stripe from 'stripe';
import { wrap } from '../wrap';

describe('Stripe type preservation', () => {
  it('should preserve the client type after wrapping', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);

    // The wrapped client should have all original properties
    expectTypeOf(wrapped.customers).toEqualTypeOf(client.customers);
    expectTypeOf(wrapped.paymentIntents).toEqualTypeOf(client.paymentIntents);
    expectTypeOf(wrapped.subscriptions).toEqualTypeOf(client.subscriptions);
    expectTypeOf(wrapped.invoices).toEqualTypeOf(client.invoices);
    expectTypeOf(wrapped.charges).toEqualTypeOf(client.charges);
  });

  it('should preserve method types on resources', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);

    // customers methods
    expectTypeOf(wrapped.customers.create).toEqualTypeOf(
      client.customers.create,
    );
    expectTypeOf(wrapped.customers.retrieve).toEqualTypeOf(
      client.customers.retrieve,
    );
    expectTypeOf(wrapped.customers.update).toEqualTypeOf(
      client.customers.update,
    );
    expectTypeOf(wrapped.customers.list).toEqualTypeOf(client.customers.list);
    expectTypeOf(wrapped.customers.del).toEqualTypeOf(client.customers.del);

    // paymentIntents methods
    expectTypeOf(wrapped.paymentIntents.create).toEqualTypeOf(
      client.paymentIntents.create,
    );
    expectTypeOf(wrapped.paymentIntents.confirm).toEqualTypeOf(
      client.paymentIntents.confirm,
    );
  });

  it('should preserve return types', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);

    type OriginalCustomerReturn = ReturnType<typeof client.customers.create>;
    type WrappedCustomerReturn = ReturnType<typeof wrapped.customers.create>;

    expectTypeOf<WrappedCustomerReturn>().toEqualTypeOf<OriginalCustomerReturn>();
  });

  it('should preserve parameter types', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);

    type OriginalParams = Parameters<typeof client.customers.create>;
    type WrappedParams = Parameters<typeof wrapped.customers.create>;

    expectTypeOf<WrappedParams>().toEqualTypeOf<OriginalParams>();
  });

  it('should add wrapkit-specific properties', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);

    expectTypeOf(wrapped.on).toBeFunction();
    expectTypeOf(wrapped.off).toBeFunction();
    expectTypeOf(wrapped.withOptions).toBeFunction();
    expectTypeOf(wrapped.stats).toBeObject();
    expectTypeOf(wrapped.queue).toBeObject();
  });

  it('should preserve types through withOptions', () => {
    const client = new Stripe('sk_test_xxx');
    const wrapped = wrap(client);
    const withPriority = wrapped.withOptions({ priority: 'critical' });

    expectTypeOf(withPriority.customers.create).toEqualTypeOf(
      client.customers.create,
    );
    expectTypeOf(withPriority.paymentIntents.create).toEqualTypeOf(
      client.paymentIntents.create,
    );
  });
});
