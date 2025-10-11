/**
 * Calculate Affiliate Commission Endpoint (T149)
 *
 * POST /api/affiliate/commissions/calculate
 *
 * Calculates and records affiliate commission for a completed transaction.
 * Called by payment webhook after successful purchase.
 *
 * Request Body:
 * - click_id: UUID of affiliate click
 * - transaction_id: UUID of completed transaction
 *
 * Flow:
 * 1. Verify click exists and belongs to active campaign
 * 2. Verify transaction completed successfully
 * 3. Calculate commission based on campaign type
 * 4. Create conversion record
 * 5. Update campaign analytics
 * 6. Mark click as converted
 *
 * Authorization: Required (system/webhook)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface CalculateCommissionRequest {
  click_id: string;
  transaction_id: string;
}

interface CommissionResult {
  conversion_id: string;
  commission_amount_cents: number;
  commission_rate?: number;
  currency: string;
  payout_status: 'pending' | 'approved' | 'paid';
}

/**
 * Calculate commission amount based on campaign type
 */
function calculateCommissionAmount(
  campaign: any,
  transactionAmount: number
): number {
  if (campaign.commission_type === 'percentage') {
    return Math.round((transactionAmount * campaign.commission_rate) / 100);
  } else if (campaign.commission_type === 'fixed') {
    return campaign.fixed_commission_cents;
  }

  throw new Error('Invalid commission type');
}

/**
 * Validate commission doesn't exceed transaction amount
 */
function validateCommission(
  commissionAmount: number,
  transactionAmount: number
): boolean {
  return commissionAmount > 0 && commissionAmount <= transactionAmount;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate webhook signature (recommended approach for webhook endpoints)
    // TODO: Implement proper webhook signature validation
    // For now, verify the request comes from trusted source via API key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
      return res.status(401).json({ error: 'Invalid webhook authentication' });
    }

    // Initialize Supabase client with service role (for system operations)
    // Note: No user auth header passed - this is a system/webhook operation
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate request body
    const { click_id, transaction_id } = req.body as CalculateCommissionRequest;

    if (!click_id) {
      return res.status(400).json({ error: 'click_id is required' });
    }

    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    // 1. Get click details with campaign
    const { data: click, error: clickError } = await supabase
      .from('affiliate_clicks')
      .select('*, affiliate_campaigns!inner(*)')
      .eq('id', click_id)
      .single();

    if (clickError || !click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    // Check if already converted
    if (click.converted) {
      return res.status(400).json({
        error: 'Click already converted',
        conversion_id: click.conversion_id,
      });
    }

    // Verify campaign is active
    const campaign = click.affiliate_campaigns;
    if (!campaign || !campaign.is_active) {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Check if campaign has reached max conversions
    if (
      campaign.max_conversions !== null &&
      campaign.total_conversions >= campaign.max_conversions
    ) {
      return res.status(400).json({ error: 'Campaign has reached maximum conversions' });
    }

    // 2. Get transaction details
    const { data: transaction, error: txnError } = await supabase
      .from('orivapay_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txnError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify transaction is successful
    if (transaction.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Transaction must be completed',
        status: transaction.status,
      });
    }

    // 3. Calculate commission
    const commissionAmount = calculateCommissionAmount(
      campaign,
      transaction.amount_cents
    );

    // Validate commission
    if (!validateCommission(commissionAmount, transaction.amount_cents)) {
      return res.status(400).json({
        error: 'Invalid commission amount',
        commission: commissionAmount,
        transaction_amount: transaction.amount_cents,
      });
    }

    // 4. Create conversion record
    const { data: conversion, error: conversionError } = await supabase
      .from('affiliate_conversions')
      .insert({
        click_id: click.id,
        campaign_id: click.campaign_id,
        affiliate_id: click.affiliate_id,
        transaction_id: transaction.id,
        commission_amount_cents: commissionAmount,
        commission_rate: campaign.commission_rate,
        currency: transaction.currency,
        payout_status: 'pending',
      })
      .select()
      .single();

    if (conversionError) {
      console.error('Conversion creation error:', conversionError);
      return res.status(500).json({ error: 'Failed to create conversion' });
    }

    // 5. Update click as converted
    const { error: updateClickError } = await supabase
      .from('affiliate_clicks')
      .update({
        converted: true,
        conversion_id: conversion.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', click.id);

    if (updateClickError) {
      console.error('Click update error:', updateClickError);
      // Non-fatal - conversion is already created
    }

    // 6. Update campaign analytics (increment conversion count)
    const { error: updateCampaignError } = await supabase
      .from('affiliate_campaigns')
      .update({
        total_conversions: (campaign.total_conversions || 0) + 1,
      })
      .eq('id', campaign.id);

    if (updateCampaignError) {
      console.error('Campaign update error:', updateCampaignError);
      // Non-fatal - conversion is already created
    }

    // Return success with commission details
    const result: CommissionResult = {
      conversion_id: conversion.id,
      commission_amount_cents: commissionAmount,
      commission_rate: campaign.commission_rate,
      currency: transaction.currency,
      payout_status: 'pending',
    };

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Commission calculation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
