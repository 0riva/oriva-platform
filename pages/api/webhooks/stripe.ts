/**
 * Stripe Webhook Handler
 * Feature: 010-orivaflow-semantic-commerce
 *
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Disable body parsing, need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // In production, verify webhook signature with Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);

    // For now, parse the body directly
    const event = JSON.parse(buf.toString());

    console.log('[Stripe Webhook]:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;

      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object);
        break;

      case 'payout.paid':
        await handlePayoutPaid(event.data.object);
        break;

      case 'payout.failed':
        await handlePayoutFailed(event.data.object);
        break;

      default:
        console.log('[Stripe Webhook]: Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook Error]:', error);
    return res.status(400).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const { id, amount, metadata } = paymentIntent;

  // Find transaction by payment intent ID
  const { data: transaction, error: fetchError } = await supabase
    .from('orivapay_transactions')
    .select('*')
    .eq('stripe_payment_intent_id', id)
    .single();

  if (fetchError || !transaction) {
    console.error('[Payment Succeeded]: Transaction not found for payment intent:', id);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'succeeded',
      metadata: {
        ...transaction.metadata,
        payment_succeeded_at: new Date().toISOString(),
      },
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error('[Payment Succeeded]: Failed to update transaction:', updateError);
    return;
  }

  // Update inventory
  await updateInventory(transaction.item_id);

  console.log('[Payment Succeeded]: Transaction updated:', transaction.id);
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const { id, last_payment_error } = paymentIntent;

  // Find transaction by payment intent ID
  const { data: transaction, error: fetchError } = await supabase
    .from('orivapay_transactions')
    .select('*')
    .eq('stripe_payment_intent_id', id)
    .single();

  if (fetchError || !transaction) {
    console.error('[Payment Failed]: Transaction not found for payment intent:', id);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'failed',
      failure_reason: last_payment_error?.message || 'Payment failed',
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error('[Payment Failed]: Failed to update transaction:', updateError);
    return;
  }

  console.log('[Payment Failed]: Transaction updated:', transaction.id);
}

/**
 * Handle refund
 */
async function handleChargeRefunded(charge: any) {
  const { id, payment_intent, amount_refunded, refunds } = charge;

  // Find transaction by payment intent ID
  const { data: transaction, error: fetchError } = await supabase
    .from('orivapay_transactions')
    .select('*')
    .eq('stripe_payment_intent_id', payment_intent)
    .single();

  if (fetchError || !transaction) {
    console.error('[Charge Refunded]: Transaction not found for charge:', id);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'refunded',
      metadata: {
        ...transaction.metadata,
        refund_amount_cents: amount_refunded,
        refunded_at: new Date().toISOString(),
        refund_id: refunds.data[0]?.id,
      },
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error('[Charge Refunded]: Failed to update transaction:', updateError);
    return;
  }

  // Restore inventory
  await restoreInventory(transaction.item_id);

  console.log('[Charge Refunded]: Transaction updated:', transaction.id);
}

/**
 * Handle Stripe Connect account update
 */
async function handleAccountUpdated(account: any) {
  const { id, charges_enabled, payouts_enabled, capabilities, requirements } = account;

  // Find account by Stripe account ID
  const { data: orivapayAccount, error: fetchError } = await supabase
    .from('orivapay_accounts')
    .select('*')
    .eq('stripe_account_id', id)
    .single();

  if (fetchError || !orivapayAccount) {
    console.error('[Account Updated]: Account not found:', id);
    return;
  }

  // Update account
  const { error: updateError } = await supabase
    .from('orivapay_accounts')
    .update({
      charges_enabled,
      payouts_enabled,
      capabilities,
      requirements,
    })
    .eq('id', orivapayAccount.id);

  if (updateError) {
    console.error('[Account Updated]: Failed to update account:', updateError);
    return;
  }

  console.log('[Account Updated]: Account updated:', orivapayAccount.id);
}

/**
 * Handle capability update
 */
async function handleCapabilityUpdated(capability: any) {
  const { account, status } = capability;

  // Find account by Stripe account ID
  const { data: orivapayAccount, error: fetchError } = await supabase
    .from('orivapay_accounts')
    .select('*')
    .eq('stripe_account_id', account)
    .single();

  if (fetchError || !orivapayAccount) {
    console.error('[Capability Updated]: Account not found:', account);
    return;
  }

  // Check if onboarding is complete
  if (status === 'active') {
    const { error: updateError } = await supabase
      .from('orivapay_accounts')
      .update({ onboarding_completed: true })
      .eq('id', orivapayAccount.id);

    if (updateError) {
      console.error('[Capability Updated]: Failed to update account:', updateError);
      return;
    }

    console.log('[Capability Updated]: Onboarding completed:', orivapayAccount.id);
  }
}

/**
 * Handle successful payout
 */
async function handlePayoutPaid(payout: any) {
  const { id, amount, destination, arrival_date } = payout;

  console.log('[Payout Paid]:', {
    payout_id: id,
    amount_cents: amount,
    destination,
    arrival_date,
  });

  // TODO: Update payout records when payout tracking is implemented
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(payout: any) {
  const { id, failure_message, destination } = payout;

  console.error('[Payout Failed]:', {
    payout_id: id,
    failure_message,
    destination,
  });

  // TODO: Update payout records and notify seller when payout tracking is implemented
}

/**
 * Update item inventory after successful purchase
 */
async function updateInventory(itemId: string) {
  try {
    const { data: item } = await supabase
      .from('entries')
      .select('marketplace_metadata')
      .eq('id', itemId)
      .single();

    if (!item || !item.marketplace_metadata) {
      return;
    }

    const metadata = item.marketplace_metadata;

    if (metadata.inventory_count !== null && metadata.inventory_count !== undefined) {
      const newCount = Math.max(0, metadata.inventory_count - 1);

      await supabase
        .from('entries')
        .update({
          marketplace_metadata: {
            ...metadata,
            inventory_count: newCount,
          },
        })
        .eq('id', itemId);
    }
  } catch (error) {
    console.error('[Update Inventory Error]:', error);
  }
}

/**
 * Restore item inventory after refund
 */
async function restoreInventory(itemId: string) {
  try {
    const { data: item } = await supabase
      .from('entries')
      .select('marketplace_metadata')
      .eq('id', itemId)
      .single();

    if (!item || !item.marketplace_metadata) {
      return;
    }

    const metadata = item.marketplace_metadata;

    if (metadata.inventory_count !== null && metadata.inventory_count !== undefined) {
      const newCount = metadata.inventory_count + 1;

      await supabase
        .from('entries')
        .update({
          marketplace_metadata: {
            ...metadata,
            inventory_count: newCount,
          },
        })
        .eq('id', itemId);
    }
  } catch (error) {
    console.error('[Restore Inventory Error]:', error);
  }
}