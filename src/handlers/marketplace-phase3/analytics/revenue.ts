/**
 * Marketplace Revenue Analytics API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/analytics/revenue - Get revenue breakdown and projections
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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
      start_date,
      end_date,
      include_projections = 'false',
    } = req.query;

    // Get transactions
    let query = supabase
      .from('orivapay_transactions')
      .select('*')
      .eq('seller_id', user.id)
      .eq('status', 'succeeded');

    if (start_date) {
      query = query.gte('created_at', start_date as string);
    }

    if (end_date) {
      query = query.lte('created_at', end_date as string);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error('[Get Revenue Error]:', txError);
      return res.status(500).json({ error: 'Failed to fetch revenue' });
    }

    // Calculate revenue breakdown
    const totalRevenue = transactions?.reduce((sum, tx) => sum + tx.amount_cents, 0) || 0;
    const platformFees = transactions?.reduce((sum, tx) => sum + tx.platform_fee_cents, 0) || 0;
    const stripeFees = transactions?.reduce((sum, tx) => sum + tx.stripe_fee_cents, 0) || 0;
    const netRevenue = transactions?.reduce((sum, tx) => sum + tx.seller_net_cents, 0) || 0;

    // Group by earner type (from transaction metadata)
    const revenueByEarnerType: Record<string, number> = {};
    transactions?.forEach(tx => {
      const earnerType = tx.metadata?.earner_type || 'unknown';
      revenueByEarnerType[earnerType] = (revenueByEarnerType[earnerType] || 0) + tx.seller_net_cents;
    });

    // Calculate monthly recurring revenue (MRR) for subscriptions
    const subscriptionRevenue = transactions?.filter(
      tx => tx.transaction_type === 'subscription' || tx.metadata?.is_recurring
    ) || [];

    const mrr = subscriptionRevenue.length > 0
      ? subscriptionRevenue.reduce((sum, tx) => sum + tx.seller_net_cents, 0) / subscriptionRevenue.length
      : 0;

    const response: any = {
      breakdown: {
        total_revenue_cents: totalRevenue,
        platform_fees_cents: platformFees,
        stripe_fees_cents: stripeFees,
        net_revenue_cents: netRevenue,
        net_percentage: totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0,
      },
      by_earner_type: Object.entries(revenueByEarnerType).map(([type, revenue]) => ({
        earner_type: type,
        revenue_cents: revenue,
        percentage: netRevenue > 0 ? (revenue / netRevenue) * 100 : 0,
      })),
      recurring: {
        monthly_recurring_revenue_cents: Math.round(mrr),
        subscription_count: subscriptionRevenue.length,
      },
    };

    // Add projections if requested
    if (include_projections === 'true' && transactions && transactions.length > 0) {
      const projections = calculateProjections(transactions);
      response.projections = projections;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('[Revenue Analytics Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function calculateProjections(transactions: any[]) {
  // Simple linear regression for next 3 months
  const dailyRevenue: Record<string, number> = {};

  transactions.forEach(tx => {
    const date = new Date(tx.created_at).toISOString().split('T')[0];
    dailyRevenue[date] = (dailyRevenue[date] || 0) + tx.seller_net_cents;
  });

  const dates = Object.keys(dailyRevenue).sort();
  if (dates.length < 7) {
    return null; // Not enough data
  }

  // Calculate average daily revenue from last 30 days
  const last30Days = dates.slice(-30);
  const avgDailyRevenue = last30Days.reduce((sum, date) => sum + dailyRevenue[date], 0) / last30Days.length;

  // Calculate growth rate (compare last 30 days to previous 30 days)
  const prev30Days = dates.slice(-60, -30);
  const prevAvgDaily = prev30Days.length > 0
    ? prev30Days.reduce((sum, date) => sum + (dailyRevenue[date] || 0), 0) / prev30Days.length
    : avgDailyRevenue;

  const growthRate = prevAvgDaily > 0
    ? (avgDailyRevenue - prevAvgDaily) / prevAvgDaily
    : 0;

  // Project next 3 months
  const projections = [];
  let projectedRevenue = avgDailyRevenue * 30; // Start with this month's projection

  for (let i = 1; i <= 3; i++) {
    projectedRevenue = projectedRevenue * (1 + growthRate);
    const date = new Date();
    date.setMonth(date.getMonth() + i);

    projections.push({
      month: date.toISOString().split('T')[0].slice(0, 7),
      projected_revenue_cents: Math.round(projectedRevenue),
      confidence: Math.max(0.5, 1 - (i * 0.15)), // Confidence decreases with time
    });
  }

  return {
    method: 'linear_regression',
    growth_rate_percentage: growthRate * 100,
    next_3_months: projections,
  };
}