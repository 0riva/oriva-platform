/**
 * Marketplace Accounts API (Stripe Connect)
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/accounts - Get user's payment account
 * POST /api/marketplace/accounts - Create Stripe Connect account
 * PATCH /api/marketplace/accounts - Update account details
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
      case 'PATCH':
        return await handlePatch(req, res, user.id);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Accounts API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - Get user's payment account
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { data: account, error } = await supabase
    .from('orivapay_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Account not found' });
    }
    console.error('[Get Account Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch account' });
  }

  return res.status(200).json({ account });
}

/**
 * POST - Create Stripe Connect account
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    account_type = 'express',
    business_type = 'individual',
    country = 'US',
    currency = 'USD',
    metadata = {},
  } = req.body;

  // Check if account already exists
  const { data: existing } = await supabase
    .from('orivapay_accounts')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    return res.status(400).json({ error: 'Account already exists' });
  }

  // Validate account type
  const validAccountTypes = ['standard', 'express', 'custom'];
  if (!validAccountTypes.includes(account_type)) {
    return res.status(400).json({ error: 'Invalid account type' });
  }

  // Create Stripe Connect account
  // Note: This would integrate with Stripe API in production
  // For now, we'll create the database record
  const stripe_account_id = `acct_${generateId()}`;

  const { data: account, error } = await supabase
    .from('orivapay_accounts')
    .insert({
      user_id: userId,
      stripe_account_id,
      account_type,
      business_type,
      country,
      currency,
      default_currency: currency,
      charges_enabled: false,
      payouts_enabled: false,
      onboarding_completed: false,
      capabilities: {},
      requirements: {},
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error('[Create Account Error]:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }

  // Generate onboarding URL
  // Note: In production, this would call Stripe's account link API
  const onboarding_url = `${process.env.NEXT_PUBLIC_APP_URL}/marketplace/onboarding?account=${account.id}`;
  const onboarding_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update account with onboarding URL
  const { data: updatedAccount } = await supabase
    .from('orivapay_accounts')
    .update({
      onboarding_url,
      onboarding_expires_at: onboarding_expires_at.toISOString(),
    })
    .eq('id', account.id)
    .select()
    .single();

  return res.status(201).json({
    account: updatedAccount,
    onboarding_url,
  });
}

/**
 * PATCH - Update account details
 */
async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    business_type,
    charges_enabled,
    payouts_enabled,
    onboarding_completed,
    capabilities,
    requirements,
    metadata,
  } = req.body;

  // Get existing account
  const { data: existing, error: fetchError } = await supabase
    .from('orivapay_accounts')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Build updates object
  const updates: any = {};

  if (business_type !== undefined) {
    updates.business_type = business_type;
  }

  if (charges_enabled !== undefined) {
    updates.charges_enabled = charges_enabled;
  }

  if (payouts_enabled !== undefined) {
    updates.payouts_enabled = payouts_enabled;
  }

  if (onboarding_completed !== undefined) {
    updates.onboarding_completed = onboarding_completed;
  }

  if (capabilities !== undefined) {
    updates.capabilities = capabilities;
  }

  if (requirements !== undefined) {
    updates.requirements = requirements;
  }

  if (metadata !== undefined) {
    updates.metadata = metadata;
  }

  // Update account
  const { data: account, error } = await supabase
    .from('orivapay_accounts')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('[Update Account Error]:', error);
    return res.status(500).json({ error: 'Failed to update account' });
  }

  return res.status(200).json({ account });
}

/**
 * Generate random ID for Stripe account simulation
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}