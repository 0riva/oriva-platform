/**
 * Marketplace Analytics Dashboard API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/analytics/dashboard - Get seller dashboard analytics
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
      period = '30d', // '7d', '30d', '90d', '1y', 'all'
      currency = 'USD',
    } = req.query;

    // Calculate date range
    const dateRange = getDateRange(period as string);

    // Get seller transactions
    const { data: transactions, error: txError } = await supabase
      .from('orivapay_transactions')
      .select('*')
      .eq('seller_id', user.id)
      .eq('status', 'succeeded')
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    if (txError) {
      console.error('[Get Transactions Error]:', txError);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    // Calculate metrics
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);
    const platformFees = transactions.reduce((sum, tx) => sum + tx.platform_fee_cents, 0);
    const stripeFees = transactions.reduce((sum, tx) => sum + tx.stripe_fee_cents, 0);
    const netRevenue = transactions.reduce((sum, tx) => sum + tx.seller_net_cents, 0);

    const totalSales = transactions.length;
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Get top selling items
    const itemSales = new Map<string, { count: number; revenue: number }>();
    transactions.forEach(tx => {
      const existing = itemSales.get(tx.item_id) || { count: 0, revenue: 0 };
      itemSales.set(tx.item_id, {
        count: existing.count + 1,
        revenue: existing.revenue + tx.amount_cents,
      });
    });

    const topItemIds = Array.from(itemSales.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => id);

    // Fetch item details
    const { data: topItems } = await supabase
      .from('entries')
      .select('id, title, marketplace_metadata')
      .in('id', topItemIds);

    const topSellingItems = topItems?.map(item => ({
      id: item.id,
      title: item.title,
      sales: itemSales.get(item.id)?.count || 0,
      revenue: itemSales.get(item.id)?.revenue || 0,
      price: item.marketplace_metadata?.price || 0,
    })) || [];

    // Calculate time series data (daily aggregation)
    const timeSeriesMap = new Map<string, number>();
    transactions.forEach(tx => {
      const date = new Date(tx.created_at).toISOString().split('T')[0];
      timeSeriesMap.set(date, (timeSeriesMap.get(date) || 0) + tx.seller_net_cents);
    });

    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get previous period for comparison
    const prevDateRange = getPreviousPeriod(dateRange);
    const { data: prevTransactions } = await supabase
      .from('orivapay_transactions')
      .select('seller_net_cents')
      .eq('seller_id', user.id)
      .eq('status', 'succeeded')
      .gte('created_at', prevDateRange.startDate.toISOString())
      .lte('created_at', prevDateRange.endDate.toISOString());

    const prevRevenue = prevTransactions?.reduce((sum, tx) => sum + tx.seller_net_cents, 0) || 0;
    const revenueGrowth = prevRevenue > 0
      ? ((netRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

    return res.status(200).json({
      period,
      currency,
      metrics: {
        total_revenue_cents: totalRevenue,
        platform_fees_cents: platformFees,
        stripe_fees_cents: stripeFees,
        net_revenue_cents: netRevenue,
        total_sales: totalSales,
        average_order_value_cents: Math.round(averageOrderValue),
        revenue_growth_percentage: revenueGrowth,
      },
      top_selling_items: topSellingItems,
      time_series: timeSeries,
    });

  } catch (error) {
    console.error('[Dashboard Analytics Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case 'all':
      startDate.setFullYear(2020, 0, 1); // Start of Oriva
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate };
}

function getPreviousPeriod(dateRange: { startDate: Date; endDate: Date }): { startDate: Date; endDate: Date } {
  const duration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
  const startDate = new Date(dateRange.startDate.getTime() - duration);
  const endDate = new Date(dateRange.endDate.getTime() - duration);
  return { startDate, endDate };
}