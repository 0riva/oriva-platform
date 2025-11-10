// @ts-nocheck - TODO: Fix type errors
// Consolidated Hugo AI & Conversations API Handler
// Handles: POST /api/v1/hugo/chat
//          POST /api/v1/hugo/knowledge/search
//          POST /api/v1/conversations (create)
//          GET /api/v1/conversations (list)
//          GET /api/v1/conversations/:id (get)
//          DELETE /api/v1/conversations/:id (delete)
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import { asyncHandler, validationError, notFoundError, forbiddenError } from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
import { composeChatContext, buildSystemPrompt, saveMessage } from '../../src/services/chat';
import { searchKnowledge } from '../../src/services/knowledge';
import { getSupabaseClient } from '../../src/config/supabase';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

interface ChatRequest {
  conversation_id: string;
  message: string;
  context?: {
    current_goals?: string[];
    metadata?: Record<string, unknown>;
  };
}

interface KnowledgeSearchRequest {
  query: string;
  category?: string;
  limit?: number;
}

interface CreateConversationRequest {
  title?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.HUGO_CLAUDE_API_KEY,
});

async function handleChat(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const startTime = Date.now();

  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { conversation_id, message, context: additionalContext }: ChatRequest = req.body;

  if (!conversation_id) {
    throw validationError('conversation_id is required');
  }

  if (!message || message.trim().length === 0) {
    throw validationError('message cannot be empty');
  }

  if (message.length > 2000) {
    throw validationError('message exceeds maximum length of 2000 characters');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversation_id)) {
    throw validationError('conversation_id must be a valid UUID');
  }

  const { conversation, history, systemPrompt } = await composeChatContext(
    userId,
    appId,
    conversation_id,
    additionalContext,
  );

  const userMessage = await saveMessage(conversation_id, 'user', message);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendSSE('start', { conversation_id, message_id: userMessage.id });

  try {
    const messages = [
      ...history.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages,
    });

    let fullResponse = '';
    let tokenCount = 0;

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullResponse += text;
        tokenCount++;

        sendSSE('token', { text, token_count: tokenCount });
      }
    }

    const assistantMessage = await saveMessage(conversation_id, 'assistant', fullResponse);

    const endTime = Date.now();
    const duration = endTime - startTime;

    sendSSE('end', {
      message_id: assistantMessage.id,
      token_count: tokenCount,
      duration_ms: duration,
    });

    res.end();
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Chat error occurred'
      : (error instanceof Error ? error.message : 'Unknown error occurred');
    sendSSE('error', {
      error: errorMessage,
      code: 'CHAT_ERROR',
    });
    res.end();
  }
}

async function handleKnowledgeSearch(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { query, category, limit = 5 }: KnowledgeSearchRequest = req.body;

  if (!query || query.trim().length === 0) {
    throw validationError('query is required');
  }

  if (query.length > 500) {
    throw validationError('query exceeds maximum length of 500 characters');
  }

  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 5, 1), 20);

  const results = await searchKnowledge(query, category, parsedLimit);

  res.status(200).json({
    query,
    category: category || 'all',
    results,
    count: results.length,
  });
}

// ============================================================================
// Conversation Management
// ============================================================================

async function handleCreateConversation(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production' ? 'App not found' : `App not found: ${appId}`;
    throw new Error(errorMessage);
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to create conversation'
      : `Failed to create conversation: ${error?.message}`;
    throw new Error(errorMessage);
  }

  res.status(201).json(data);
}

async function handleListConversations(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production' ? 'App not found' : `App not found: ${appId}`;
    throw new Error(errorMessage);
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to fetch conversations'
      : `Failed to fetch conversations: ${error.message}`;
    throw new Error(errorMessage);
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

async function handleGetConversation(req: AuthenticatedRequest, res: VercelResponse, conversationId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to fetch messages'
      : `Failed to fetch messages: ${messagesError.message}`;
    throw new Error(errorMessage);
  }

  res.status(200).json({
    ...conversation,
    messages: messages || [],
  });
}

async function handleDeleteConversation(req: AuthenticatedRequest, res: VercelResponse, conversationId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to delete conversation'
      : `Failed to delete conversation: ${deleteError.message}`;
    throw new Error(errorMessage);
  }

  res.status(204).end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;
        const { url, method } = req;
        const { id } = req.query;

        // Hugo endpoints (POST only)
        if (url?.includes('/hugo/')) {
          if (method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
            return;
          }

          // POST /api/v1/hugo/knowledge/search
          if (url?.match(/\/knowledge\/search$/)) {
            return handleKnowledgeSearch(authReq, res);
          }

          // POST /api/v1/hugo/chat
          if (url?.match(/\/chat$/)) {
            return handleChat(authReq, res);
          }

          res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
          return;
        }

        // Conversation endpoints (handles /api/v1/conversations)
        if (url?.includes('/conversations')) {
          // POST /api/v1/conversations (create)
          if (method === 'POST' && !id) {
            return handleCreateConversation(authReq, res);
          }

          // GET /api/v1/conversations (list)
          if (method === 'GET' && !id) {
            return handleListConversations(authReq, res);
          }

          // GET /api/v1/conversations/:id (get)
          if (method === 'GET' && id && typeof id === 'string') {
            return handleGetConversation(authReq, res, id);
          }

          // DELETE /api/v1/conversations/:id (delete)
          if (method === 'DELETE' && id && typeof id === 'string') {
            return handleDeleteConversation(authReq, res, id);
          }

          res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
          return;
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
