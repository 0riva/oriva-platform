// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Transaction Detail API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/transactions/[id] - Get transaction details
 * PATCH /api/marketplace/transactions/[id] - Update transaction status
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
  const { method, query } = req;
  const { id } = query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Transaction ID required' });
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
    switch (method) {
      case 'GET':
        return await handleGet(req, res, user.id, id);
      case 'PATCH':
        return await handlePatch(req, res, user.id, id);
      default:
        res.setHeader('Allow', ['GET', 'PATCH']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Transaction Detail API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - Get transaction details
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  transactionId: string
) {
  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .select(`
      *,
      buyer:auth.users!buyer_id(id, email),
      seller:auth.users!seller_id(id, email),
      item:entries!item_id(
        id,
        title,
        content,
        marketplace_metadata,
        profiles!inner(id, username, display_name, avatar_url)
      ),
      escrow:orivapay_escrow(*)
    `)
    .eq('id', transactionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    console.error('[Get Transaction Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction' });
  }

  // Verify user has access to this transaction
  if (transaction.buyer_id !== userId && transaction.seller_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(200).json({ transaction });
}

/**
 * PATCH - Update transaction status (service role only)
 */
async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  transactionId: string
) {
  // Only service role can update transaction status
  if (req.headers['x-service-role'] !== 'true') {
    return res.status(403).json({ error: 'Forbidden - Service role required' });
  }

  const { status, failure_reason, stripe_transfer_id, metadata } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status required' });
  }

  // Validate status
  const validStatuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updates: any = { status };

  if (failure_reason) {
    updates.failure_reason = failure_reason;
  }

  if (stripe_transfer_id) {
    updates.stripe_transfer_id = stripe_transfer_id;
  }

  if (metadata) {
    updates.metadata = metadata;
  }

  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .update(updates)
    .eq('id', transactionId)
    .select()
    .single();

  if (error) {
    console.error('[Update Transaction Error]:', error);
    return res.status(500).json({ error: 'Failed to update transaction' });
  }

  // If transaction succeeded, update inventory
  if (status === 'succeeded') {
    await updateInventory(transaction.item_id);
  }

  return res.status(200).json({ transaction });
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

    // Only update if inventory tracking is enabled
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
    // Don't fail the transaction update if inventory update fails
  }
}