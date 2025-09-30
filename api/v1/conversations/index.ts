// Task: T046-T047 - Create and list conversations
// Description: Conversation session management

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { getSupabaseClient } from '../../config/supabase';
import { randomUUID } from 'crypto';

interface CreateConversationRequest {
  title?: string;
}

async function createConversationHandler(
  req: AuthenticatedRequest,
  res: VercelResponse,
): Promise<void> {
  // Get app ID from header
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { title }: CreateConversationRequest = req.body;

  const supabase = getSupabaseClient();

  // Get app UUID from app_id
  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select('id')
    .eq('app_id', appId)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

  // Create conversation
  const sessionId = randomUUID();
  const { data, error } = await supabase
    .from('hugo_conversations')
    .insert({
      session_id: sessionId,
      user_id: userId,
      app_id: appData.id,
      title: title || `Coaching Session ${new Date().toLocaleDateString()}`,
      message_count: 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create conversation: ${error?.message}`);
  }

  res.status(201).json(data);
}

async function listConversationsHandler(
  req: AuthenticatedRequest,
  res: VercelResponse,
): Promise<void> {
  // Get app ID from header
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { limit = '10', offset = '0', status } = req.query;

  const supabase = getSupabaseClient();

  // Get app UUID
  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select('id')
    .eq('app_id', appId)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

  // Build query
  let query = supabase
    .from('hugo_conversations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('app_id', appData.id)
    .order('last_message_at', { ascending: false });

  // Filter by status
  if (status === 'active') {
    query = query.is('closed_at', null);
  } else if (status === 'closed') {
    query = query.not('closed_at', 'is', null);
  }

  // Pagination
  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list conversations: ${error.message}`);
  }

  res.status(200).json({
    conversations: data || [],
    total_count: count || 0,
  });
}

async function conversationsHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'POST') {
    await createConversationHandler(req as AuthenticatedRequest, res);
  } else if (req.method === 'GET') {
    await listConversationsHandler(req as AuthenticatedRequest, res);
  } else {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(conversationsHandler)(req, res);
    });
  });
}