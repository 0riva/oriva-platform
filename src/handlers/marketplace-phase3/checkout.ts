// @ts-nocheck - TODO: Fix type errors
// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Checkout API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * POST /api/marketplace/checkout - Create Stripe payment intent and initiate transaction
 */

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Get user from authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const {
      item_id,
      payment_method_id,
      uses_escrow = false,
      return_url,
    } = req.body;

    if (!item_id) {
      return res.status(400).json({ error: 'item_id required' });
    }

    // Fetch item details
    const { data: item, error: itemError } = await supabase
      .from('entries')
      .select('*, profiles!inner(id, username, user_id)')
      .eq('id', item_id)
      .eq('entry_type', 'marketplace_item')
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const metadata = item.marketplace_metadata;
    if (!metadata || !metadata.is_published) {
      return res.status(400).json({ error: 'Item not available for purchase' });
    }

    // Check inventory
    if (metadata.inventory_count !== null && metadata.inventory_count <= 0) {
      return res.status(400).json({ error: 'Item out of stock' });
    }

    const seller_id = item.profiles.user_id;

    // Prevent self-purchase
    if (seller_id === user.id) {
      return res.status(400).json({ error: 'Cannot purchase your own item' });
    }

    // Get seller's Stripe account
    const { data: sellerAccount } = await supabase
      .from('orivapay_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', seller_id)
      .single();

    if (!sellerAccount || !sellerAccount.charges_enabled) {
      return res.status(400).json({
        error: 'Seller payment account not configured'
      });
    }

    // Calculate amounts (price is in cents)
    const amount_cents = Math.round(metadata.price * 100);

    // Calculate fees based on earner type
    const earner_type = metadata.earner_type || 'vendor';
    const platformFeeRates: Record<string, number> = {
      creator: 0.15,
      vendor: 0.12,
      developer: 0.20,
      advertiser: 0.15,
      affiliate: 0.10,
      influencer: 0.18,
    };

    const platformFeeRate = platformFeeRates[earner_type] || 0.12;
    const platform_fee_cents = Math.round(amount_cents * platformFeeRate);

    // Stripe fee: 2.9% + 30¢
    const stripe_fee_cents = Math.round(amount_cents * 0.029) + 30;

    const seller_net_cents = amount_cents - platform_fee_cents - stripe_fee_cents;

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: metadata.currency || 'usd',
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      transfer_data: uses_escrow ? undefined : {
        destination: sellerAccount.stripe_account_id,
        amount: seller_net_cents,
      },
      metadata: {
        item_id,
        buyer_id: user.id,
        seller_id,
        uses_escrow: String(uses_escrow),
        earner_type,
      },
    });

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('orivapay_transactions')
      .insert({
        buyer_id: user.id,
        seller_id,
        item_id,
        transaction_type: 'purchase',
        amount_cents,
        currency: metadata.currency || 'USD',
        platform_fee_cents,
        stripe_fee_cents,
        seller_net_cents,
        payment_method: 'card',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        uses_escrow,
        metadata: {
          earner_type,
          item_title: item.title,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('[Create Transaction Error]:', txError);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }

    // If using escrow, create escrow record
    if (uses_escrow) {
      await supabase
        .from('orivapay_escrow')
        .insert({
          transaction_id: transaction.id,
          amount_cents: seller_net_cents,
          currency: metadata.currency || 'USD',
          release_type: 'manual',
          status: 'held',
        });
    }

    return res.status(200).json({
      transaction_id: transaction.id,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });

  } catch (error) {
    console.error('[Checkout Error]:', error);
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}