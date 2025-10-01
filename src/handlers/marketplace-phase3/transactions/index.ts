// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Transactions API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/transactions - List transactions for user
 * POST /api/marketplace/transactions - Create new transaction (internal use)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

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
    switch (method) {
      case 'GET':
        return await handleGet(req, res, user.id);
      case 'POST':
        return await handlePost(req, res, user.id);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Transactions API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - List transactions for the authenticated user
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    role = 'buyer', // 'buyer' or 'seller'
    status,
    limit = '20',
    offset = '0',
  } = req.query;

  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);

  let query = supabase
    .from('orivapay_transactions')
    .select(`
      *,
      buyer:auth.users!buyer_id(id, email),
      seller:auth.users!seller_id(id, email),
      item:entries!item_id(id, title, content, marketplace_metadata)
    `)
    .order('created_at', { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1);

  // Filter by role
  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else if (role === 'seller') {
    query = query.eq('seller_id', userId);
  }

  // Filter by status
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Get Transactions Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }

  return res.status(200).json({
    transactions: data,
    pagination: {
      limit: limitNum,
      offset: offsetNum,
      total: count,
    },
  });
}

/**
 * POST - Create a new transaction (called by checkout service)
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    buyer_id,
    seller_id,
    item_id,
    transaction_type,
    amount_cents,
    currency = 'USD',
    platform_fee_cents,
    stripe_fee_cents,
    seller_net_cents,
    payment_method,
    stripe_payment_intent_id,
    uses_escrow = false,
    metadata = {},
  } = req.body;

  // Validate required fields
  if (!buyer_id || !seller_id || !item_id || !amount_cents) {
    return res.status(400).json({
      error: 'Missing required fields: buyer_id, seller_id, item_id, amount_cents',
    });
  }

  // Verify the user is either the buyer or has service role
  if (buyer_id !== userId && req.headers['x-service-role'] !== 'true') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Create transaction
  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .insert({
      buyer_id,
      seller_id,
      item_id,
      transaction_type: transaction_type || 'purchase',
      amount_cents,
      currency,
      platform_fee_cents,
      stripe_fee_cents,
      seller_net_cents,
      payment_method: payment_method || 'card',
      stripe_payment_intent_id,
      status: 'pending',
      uses_escrow,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('[Create Transaction Error]:', error);
    return res.status(500).json({ error: 'Failed to create transaction' });
  }

  return res.status(201).json({ transaction });
}