/**
 * Create Affiliate Campaign Endpoint (T146)
 *
 * POST /api/affiliate/campaigns/create
 *
 * Creates a new affiliate campaign for a marketplace item.
 *
 * Request Body:
 * - item_id: UUID of marketplace item
 * - name: Campaign name (3-200 characters)
 * - commission_type: 'percentage' | 'fixed'
 * - commission_rate?: number (1-100 for percentage)
 * - fixed_commission_cents?: number (for fixed type)
 * - start_date?: ISO date string
 * - end_date?: ISO date string
 * - max_conversions?: number
 *
 * Authorization: Required (item owner)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface CreateCampaignRequest {
  item_id: string;
  name: string;
  commission_type: 'percentage' | 'fixed';
  commission_rate?: number;
  fixed_commission_cents?: number;
  start_date?: string;
  end_date?: string;
  max_conversions?: number;
}

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate campaign creation request
 */
function validateCampaignRequest(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.item_id) {
    errors.push({ field: 'item_id', message: 'Item ID is required' });
  }

  if (!data.name) {
    errors.push({ field: 'name', message: 'Campaign name is required' });
  } else if (data.name.length < 3) {
    errors.push({ field: 'name', message: 'Campaign name must be at least 3 characters' });
  } else if (data.name.length > 200) {
    errors.push({ field: 'name', message: 'Campaign name must not exceed 200 characters' });
  }

  if (!data.commission_type) {
    errors.push({ field: 'commission_type', message: 'Commission type is required' });
  } else if (!['percentage', 'fixed'].includes(data.commission_type)) {
    errors.push({ field: 'commission_type', message: 'Commission type must be "percentage" or "fixed"' });
  }

  // Commission type-specific validation
  if (data.commission_type === 'percentage') {
    if (data.commission_rate === undefined) {
      errors.push({ field: 'commission_rate', message: 'Commission rate is required for percentage type' });
    } else if (data.commission_rate <= 0 || data.commission_rate > 100) {
      errors.push({ field: 'commission_rate', message: 'Commission rate must be between 1 and 100' });
    }
  }

  if (data.commission_type === 'fixed') {
    if (data.fixed_commission_cents === undefined) {
      errors.push({ field: 'fixed_commission_cents', message: 'Fixed commission amount is required for fixed type' });
    } else if (data.fixed_commission_cents <= 0) {
      errors.push({ field: 'fixed_commission_cents', message: 'Fixed commission must be greater than 0' });
    }
  }

  // Date validation
  if (data.start_date && isNaN(new Date(data.start_date).getTime())) {
    errors.push({ field: 'start_date', message: 'Invalid start date format' });
  }

  if (data.end_date && isNaN(new Date(data.end_date).getTime())) {
    errors.push({ field: 'end_date', message: 'Invalid end date format' });
  }

  if (data.start_date && data.end_date && new Date(data.end_date) <= new Date(data.start_date)) {
    errors.push({ field: 'end_date', message: 'End date must be after start date' });
  }

  // Max conversions validation
  if (data.max_conversions !== undefined && data.max_conversions <= 0) {
    errors.push({ field: 'max_conversions', message: 'Max conversions must be greater than 0' });
  }

  return errors;
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
    // Initialize Supabase client with user's auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Validate request body
    const validationErrors = validateCampaignRequest(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const campaignData: CreateCampaignRequest = req.body;

    // Verify item exists and is a marketplace item
    const { data: item, error: itemError } = await supabase
      .from('entries')
      .select('id, user_id, entry_type, marketplace_metadata')
      .eq('id', campaignData.item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.entry_type !== 'marketplace_item') {
      return res.status(400).json({ error: 'Item is not a marketplace item' });
    }

    // Verify user owns the item
    if (item.user_id !== user.id) {
      return res.status(403).json({ error: 'You can only create campaigns for your own items' });
    }

    // Create campaign
    const { data: campaign, error: createError } = await supabase
      .from('affiliate_campaigns')
      .insert({
        affiliate_id: user.id,
        item_id: campaignData.item_id,
        name: campaignData.name,
        commission_type: campaignData.commission_type,
        commission_rate: campaignData.commission_rate || null,
        fixed_commission_cents: campaignData.fixed_commission_cents || null,
        start_date: campaignData.start_date || new Date().toISOString(),
        end_date: campaignData.end_date || null,
        max_conversions: campaignData.max_conversions || null,
        is_active: true,
        total_clicks: 0,
        total_conversions: 0,
      })
      .select('*, entries!inner(*)')
      .single();

    if (createError) {
      console.error('Campaign creation error:', createError);
      return res.status(500).json({ error: 'Failed to create campaign' });
    }

    // Return success with campaign data
    return res.status(201).json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
