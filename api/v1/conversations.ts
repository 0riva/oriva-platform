// Consolidated Conversations API Handler
// Handles: POST /api/v1/conversations (create)
//          GET /api/v1/conversations (list)
//          GET /api/v1/conversations/:id (get)
//          DELETE /api/v1/conversations/:id (delete)
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../src/middleware/auth';
import { asyncHandler, validationError, notFoundError, forbiddenError } from '../src/middleware/error-handler';
import { rateLimit } from '../src/middleware/rate-limit';
import { getSupabaseClient } from '../src/config/supabase';
import { randomUUID } from 'crypto';

interface CreateConversationRequest {
  title?: string;
}

async function handleCreate(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { title }: CreateConversationRequest = req.body;

  const supabase = getSupabaseClient();

  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select('id')
    .eq('app_id', appId)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

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

async function handleList(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { limit = '10', offset = '0', status } = req.query;

  const supabase = getSupabaseClient();

  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select('id')
    .eq('app_id', appId)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

  let query = supabase
    .from('hugo_conversations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('app_id', appData.id)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const parsedLimit = Math.min(parseInt(limit as string, 10) || 10, 100);
  const parsedOffset = parseInt(offset as string, 10) || 0;

  query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  res.status(200).json({
    conversations: data || [],
    pagination: {
      total: count || 0,
      limit: parsedLimit,
      offset: parsedOffset,
    },
  });
}

async function handleGet(req: AuthenticatedRequest, res: VercelResponse, conversationId: string): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  const { data: conversation, error: convError } = await supabase
    .from('hugo_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw notFoundError('Conversation');
  }

  if (conversation.user_id !== userId) {
    throw forbiddenError('Access to this conversation is forbidden');
  }

  const { data: messages, error: messagesError } = await supabase
    .from('hugo_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`);
  }

  res.status(200).json({
    ...conversation,
    messages: messages || [],
  });
}

async function handleDelete(req: AuthenticatedRequest, res: VercelResponse, conversationId: string): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  const { data: conversation, error: convError } = await supabase
    .from('hugo_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw notFoundError('Conversation');
  }

  if (conversation.user_id !== userId) {
    throw forbiddenError('Access to this conversation is forbidden');
  }

  const { error: deleteError } = await supabase
    .from('hugo_conversations')
    .delete()
    .eq('id', conversationId);

  if (deleteError) {
    throw new Error(`Failed to delete conversation: ${deleteError.message}`);
  }

  res.status(204).end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;
        const { method } = req;
        const { id } = req.query;

        // POST /api/v1/conversations (create)
        if (method === 'POST' && !id) {
          return handleCreate(authReq, res);
        }

        // GET /api/v1/conversations (list)
        if (method === 'GET' && !id) {
          return handleList(authReq, res);
        }

        // GET /api/v1/conversations/:id (get)
        if (method === 'GET' && id && typeof id === 'string') {
          return handleGet(authReq, res, id);
        }

        // DELETE /api/v1/conversations/:id (delete)
        if (method === 'DELETE' && id && typeof id === 'string') {
          return handleDelete(authReq, res, id);
        }

        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
      });
    });
  })(req, res);
}
