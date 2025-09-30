/**
 * Marketplace Analytics API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/analytics - Get aggregated analytics data
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
    return await handleGet(req, res, user.id);
  } catch (error) {
    console.error('[Analytics API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - Get analytics data for the authenticated user
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    role = 'seller', // 'buyer' or 'seller'
    period = '30d', // '7d', '30d', '90d', 'all'
    earner_type, // Optional: 'creator', 'vendor', 'developer', 'advertiser', 'affiliate', 'influencer'
  } = req.query;

  // Calculate date range
  const startDate = getStartDate(period as string);

  // Fetch all analytics data in parallel
  const [
    revenueData,
    salesCountData,
    topItemsData,
    recentSalesData,
    conversionData,
  ] = await Promise.all([
    getRevenueMetrics(userId, role as string, startDate, earner_type as string),
    getSalesCount(userId, role as string, startDate, earner_type as string),
    getTopItems(userId, role as string, startDate, earner_type as string),
    getRecentSales(userId, role as string, startDate, earner_type as string),
    getConversionMetrics(userId, role as string, startDate, earner_type as string),
  ]);

  return res.status(200).json({
    period,
    role,
    earner_type: earner_type || null,
    revenue: revenueData,
    sales: salesCountData,
    top_items: topItemsData,
    recent_sales: recentSalesData,
    conversion: conversionData,
  });
}

/**
 * Get revenue metrics
 */
async function getRevenueMetrics(
  userId: string,
  role: string,
  startDate: Date | null,
  earnerType?: string
) {
  let query = supabase
    .from('orivapay_transactions')
    .select('amount_cents, seller_net_cents, platform_fee_cents, stripe_fee_cents, created_at, currency, status');

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else {
    query = query.eq('seller_id', userId);
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  query = query.eq('status', 'succeeded');

  const { data, error } = await query;

  if (error) {
    console.error('[Revenue Metrics Error]:', error);
    throw error;
  }

  // Filter by earner type if specified
  let filteredData = data;
  if (earnerType && role === 'seller') {
    // Join with item metadata to filter by earner type
    const itemIds = data.map(t => t.item_id);
    const { data: items } = await supabase
      .from('entries')
      .select('id, marketplace_metadata')
      .in('id', itemIds);

    const relevantItemIds = items
      ?.filter(item => item.marketplace_metadata?.earner_type === earnerType)
      .map(item => item.id) || [];

    filteredData = data.filter(t => relevantItemIds.includes(t.item_id));
  }

  // Calculate totals
  const totalRevenue = filteredData.reduce((sum, t) => sum + t.amount_cents, 0);
  const totalNet = filteredData.reduce((sum, t) => sum + (role === 'seller' ? t.seller_net_cents : t.amount_cents), 0);
  const totalPlatformFees = filteredData.reduce((sum, t) => sum + t.platform_fee_cents, 0);
  const totalStripeFees = filteredData.reduce((sum, t) => sum + t.stripe_fee_cents, 0);

  // Calculate daily breakdown for chart
  const dailyBreakdown = calculateDailyBreakdown(filteredData, role);

  return {
    total_revenue_cents: totalRevenue,
    total_net_cents: totalNet,
    platform_fees_cents: totalPlatformFees,
    stripe_fees_cents: totalStripeFees,
    currency: filteredData[0]?.currency || 'USD',
    daily_breakdown: dailyBreakdown,
  };
}

/**
 * Get sales count metrics
 */
async function getSalesCount(
  userId: string,
  role: string,
  startDate: Date | null,
  earnerType?: string
) {
  let query = supabase
    .from('orivapay_transactions')
    .select('id, status, created_at, item_id');

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else {
    query = query.eq('seller_id', userId);
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Sales Count Error]:', error);
    throw error;
  }

  // Filter by earner type if specified
  let filteredData = data;
  if (earnerType && role === 'seller') {
    const itemIds = data.map(t => t.item_id);
    const { data: items } = await supabase
      .from('entries')
      .select('id, marketplace_metadata')
      .in('id', itemIds);

    const relevantItemIds = items
      ?.filter(item => item.marketplace_metadata?.earner_type === earnerType)
      .map(item => item.id) || [];

    filteredData = data.filter(t => relevantItemIds.includes(t.item_id));
  }

  const totalSales = filteredData.length;
  const succeededSales = filteredData.filter(t => t.status === 'succeeded').length;
  const pendingSales = filteredData.filter(t => t.status === 'pending' || t.status === 'processing').length;
  const failedSales = filteredData.filter(t => t.status === 'failed' || t.status === 'cancelled').length;

  return {
    total: totalSales,
    succeeded: succeededSales,
    pending: pendingSales,
    failed: failedSales,
  };
}

/**
 * Get top selling items
 */
async function getTopItems(
  userId: string,
  role: string,
  startDate: Date | null,
  earnerType?: string
) {
  if (role !== 'seller') {
    return [];
  }

  let query = supabase
    .from('orivapay_transactions')
    .select('item_id, amount_cents, seller_net_cents')
    .eq('seller_id', userId)
    .eq('status', 'succeeded');

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Top Items Error]:', error);
    throw error;
  }

  // Group by item_id
  const itemStats = data.reduce((acc, t) => {
    if (!acc[t.item_id]) {
      acc[t.item_id] = {
        item_id: t.item_id,
        sales_count: 0,
        total_revenue_cents: 0,
        total_net_cents: 0,
      };
    }
    acc[t.item_id].sales_count++;
    acc[t.item_id].total_revenue_cents += t.amount_cents;
    acc[t.item_id].total_net_cents += t.seller_net_cents;
    return acc;
  }, {} as Record<string, any>);

  // Get item details
  const itemIds = Object.keys(itemStats);
  const { data: items } = await supabase
    .from('entries')
    .select('id, title, content, marketplace_metadata')
    .in('id', itemIds);

  // Filter by earner type if specified
  let filteredItems = items || [];
  if (earnerType) {
    filteredItems = filteredItems.filter(item =>
      item.marketplace_metadata?.earner_type === earnerType
    );
  }

  // Combine and sort
  const topItems = filteredItems
    .map(item => ({
      ...itemStats[item.id],
      title: item.title,
      earner_type: item.marketplace_metadata?.earner_type,
      price_cents: item.marketplace_metadata?.price,
    }))
    .sort((a, b) => b.total_revenue_cents - a.total_revenue_cents)
    .slice(0, 10);

  return topItems;
}

/**
 * Get recent sales
 */
async function getRecentSales(
  userId: string,
  role: string,
  startDate: Date | null,
  earnerType?: string
) {
  let query = supabase
    .from('orivapay_transactions')
    .select(`
      id,
      amount_cents,
      seller_net_cents,
      status,
      created_at,
      item:entries!item_id(id, title, marketplace_metadata),
      buyer:auth.users!buyer_id(id, email),
      seller:auth.users!seller_id(id, email)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else {
    query = query.eq('seller_id', userId);
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Recent Sales Error]:', error);
    throw error;
  }

  // Filter by earner type if specified
  let filteredData = data;
  if (earnerType && role === 'seller') {
    filteredData = data.filter(t =>
      t.item?.marketplace_metadata?.earner_type === earnerType
    );
  }

  return filteredData.slice(0, 10);
}

/**
 * Get conversion metrics
 */
async function getConversionMetrics(
  userId: string,
  role: string,
  startDate: Date | null,
  earnerType?: string
) {
  if (role !== 'seller') {
    return {
      views: 0,
      clicks: 0,
      conversions: 0,
      conversion_rate: 0,
    };
  }

  // Get successful transactions
  let query = supabase
    .from('orivapay_transactions')
    .select('item_id')
    .eq('seller_id', userId)
    .eq('status', 'succeeded');

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data: transactions } = await query;

  // Note: Views and clicks would come from a separate analytics table
  // For now, we'll just return conversion count
  // TODO: Implement view/click tracking in future iteration

  let conversions = transactions?.length || 0;

  // Filter by earner type if specified
  if (earnerType && transactions) {
    const itemIds = transactions.map(t => t.item_id);
    const { data: items } = await supabase
      .from('entries')
      .select('id, marketplace_metadata')
      .in('id', itemIds);

    const relevantItemIds = items
      ?.filter(item => item.marketplace_metadata?.earner_type === earnerType)
      .map(item => item.id) || [];

    conversions = transactions.filter(t => relevantItemIds.includes(t.item_id)).length;
  }

  return {
    views: 0, // TODO: Implement view tracking
    clicks: 0, // TODO: Implement click tracking
    conversions,
    conversion_rate: 0, // TODO: Calculate when views are tracked
  };
}

/**
 * Calculate daily breakdown for revenue chart
 */
function calculateDailyBreakdown(transactions: any[], role: string) {
  const breakdown: Record<string, number> = {};

  transactions.forEach(t => {
    const date = new Date(t.created_at).toISOString().split('T')[0];
    const amount = role === 'seller' ? t.seller_net_cents : t.amount_cents;

    if (!breakdown[date]) {
      breakdown[date] = 0;
    }
    breakdown[date] += amount;
  });

  return Object.entries(breakdown)
    .map(([date, amount]) => ({ date, amount_cents: amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get start date based on period
 */
function getStartDate(period: string): Date | null {
  if (period === 'all') {
    return null;
  }

  const now = new Date();

  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}