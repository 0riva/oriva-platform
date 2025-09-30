/**
 * Marketplace Escrow API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/escrow/[id] - Get escrow details
 * POST /api/marketplace/escrow/[id]/release - Release escrow funds
 * POST /api/marketplace/escrow/[id]/dispute - Open dispute
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
    return res.status(400).json({ error: 'Escrow ID required' });
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
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Escrow API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - Get escrow details
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  escrowId: string
) {
  const { data: escrow, error } = await supabase
    .from('orivapay_escrow')
    .select(`
      *,
      transaction:orivapay_transactions!transaction_id(
        id,
        buyer_id,
        seller_id,
        item_id,
        amount_cents,
        status,
        buyer:auth.users!buyer_id(id, email),
        seller:auth.users!seller_id(id, email),
        item:entries!item_id(id, title, content, marketplace_metadata)
      ),
      released_by_user:auth.users!released_by(id, email),
      agreement:agreements(id, title, status)
    `)
    .eq('id', escrowId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    console.error('[Get Escrow Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch escrow' });
  }

  // Verify user has access (buyer or seller)
  if (
    escrow.transaction.buyer_id !== userId &&
    escrow.transaction.seller_id !== userId
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.status(200).json({ escrow });
}