// Consolidated Webhooks API Handler
// Handles: POST/GET /api/v1/apps/:appId/webhooks
//          PATCH/DELETE /api/v1/apps/:appId/webhooks/:id
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { rateLimit } from '../../src/middleware/rate-limit';
import { authenticate } from '../../src/middleware/auth';
import { getSupabaseClient } from '../../src/config/supabase';

interface CreateWebhookRequest {
  webhook_url: string;
  subscribed_events: string[];
}

interface UpdateWebhookRequest {
  webhook_url?: string;
  subscribed_events?: string[];
  is_active?: boolean;
}

async function handleCreate(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  const { webhook_url, subscribed_events }: CreateWebhookRequest = req.body;

  // Validate webhook_url
  if (!webhook_url) {
    res.status(400).json({ error: 'webhook_url is required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const url = new URL(webhook_url);
    if (url.protocol !== 'https:') {
      res.status(400).json({ error: 'webhook_url must use HTTPS', code: 'INVALID_URL' });
      return;
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid webhook_url format', code: 'INVALID_URL' });
    return;
  }

  // Validate subscribed_events
  if (!subscribed_events || !Array.isArray(subscribed_events) || subscribed_events.length === 0) {
    res.status(400).json({ error: 'subscribed_events must be a non-empty array', code: 'INVALID_EVENTS' });
    return;
  }

  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .insert({
        app_id: appId,
        webhook_url,
        webhook_secret: webhookSecret,
        subscribed_events,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(201).json({
      webhook_id: data.id,
      webhook_secret: webhookSecret,
    });
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleList(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .select(
        'id, app_id, webhook_url, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at'
      )
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(200).json({
      webhooks: data || [],
    });
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, appId: string, id: string): Promise<void> {
  const { webhook_url, subscribed_events, is_active }: UpdateWebhookRequest = req.body;

  if (!webhook_url && !subscribed_events && is_active === undefined) {
    res.status(400).json({
      error: 'At least one field must be provided: webhook_url, subscribed_events, or is_active',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const updates: any = {};
  if (webhook_url) {
    try {
      const url = new URL(webhook_url);
      if (url.protocol !== 'https:') {
        res.status(400).json({ error: 'webhook_url must use HTTPS', code: 'INVALID_URL' });
        return;
      }
      updates.webhook_url = webhook_url;
    } catch (error) {
      res.status(400).json({ error: 'Invalid webhook_url format', code: 'INVALID_URL' });
      return;
    }
  }

  if (subscribed_events) {
    if (!Array.isArray(subscribed_events) || subscribed_events.length === 0) {
      res.status(400).json({ error: 'subscribed_events must be a non-empty array', code: 'INVALID_EVENTS' });
      return;
    }
    updates.subscribed_events = subscribed_events;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .update(updates)
      .eq('id', id)
      .eq('app_id', appId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Webhook not found or not authorized', code: 'NOT_FOUND' });
        return;
      }
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, appId: string, id: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('app_webhooks').delete().eq('id', id).eq('app_id', appId);

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Webhook not found or not authorized', code: 'NOT_FOUND' });
        return;
      }
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      const { method } = req;
      const { appId, id } = req.query;

      if (!appId || typeof appId !== 'string') {
        res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      // POST /api/v1/apps/:appId/webhooks (create)
      if (method === 'POST') {
        return handleCreate(req, res, appId);
      }

      // GET /api/v1/apps/:appId/webhooks (list)
      if (method === 'GET' && !id) {
        return handleList(req, res, appId);
      }

      // PATCH /api/v1/apps/:appId/webhooks/:id (update)
      if (method === 'PATCH' && id && typeof id === 'string') {
        return handleUpdate(req, res, appId, id);
      }

      // DELETE /api/v1/apps/:appId/webhooks/:id (delete)
      if (method === 'DELETE' && id && typeof id === 'string') {
        return handleDelete(req, res, appId, id);
      }

      res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    });
  });
}
