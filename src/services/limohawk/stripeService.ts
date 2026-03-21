/**
 * LimoHawk Stripe Subscription Service
 * Stub — implement when Stripe subscription handling is wired up
 */

import Stripe from 'stripe';

export async function handleCheckoutCompleted(_session: Stripe.Checkout.Session): Promise<void> {
  // TODO: Implement checkout completed handler
}

export async function handleSubscriptionCreated(_subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement subscription created handler
}

export async function handleInvoicePaid(_invoice: Stripe.Invoice): Promise<void> {
  // TODO: Implement invoice paid handler
}

export async function handleInvoicePaymentFailed(_invoice: Stripe.Invoice): Promise<void> {
  // TODO: Implement payment failed handler
}

export async function handleSubscriptionUpdated(_subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement subscription updated handler
}

export async function handleSubscriptionDeleted(_subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement subscription deleted handler
}
