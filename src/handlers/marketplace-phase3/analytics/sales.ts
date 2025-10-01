// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Sales Analytics API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/analytics/sales - Get detailed sales analytics
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
      group_by = 'day', // 'day', 'week', 'month'
      item_id,
    } = req.query;

    // Build query
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

    if (item_id) {
      query = query.eq('item_id', item_id);
    }

    query = query.order('created_at', { ascending: true });

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error('[Get Sales Error]:', txError);
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    // Group transactions by period
    const grouped = groupTransactions(transactions || [], group_by as string);

    // Calculate metrics for each period
    const analytics = Object.entries(grouped).map(([period, txs]) => {
      const revenue = txs.reduce((sum, tx) => sum + tx.seller_net_cents, 0);
      const sales = txs.length;
      const averageValue = sales > 0 ? revenue / sales : 0;

      return {
        period,
        revenue_cents: revenue,
        sales_count: sales,
        average_order_value_cents: Math.round(averageValue),
        transactions: txs.map(tx => ({
          id: tx.id,
          amount_cents: tx.amount_cents,
          seller_net_cents: tx.seller_net_cents,
          created_at: tx.created_at,
        })),
      };
    });

    return res.status(200).json({
      analytics,
      total: {
        revenue_cents: transactions?.reduce((sum, tx) => sum + tx.seller_net_cents, 0) || 0,
        sales_count: transactions?.length || 0,
      },
    });

  } catch (error) {
    console.error('[Sales Analytics Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function groupTransactions(
  transactions: any[],
  groupBy: string
): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  transactions.forEach(tx => {
    const date = new Date(tx.created_at);
    let key: string;

    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(tx);
  });

  return grouped;
}