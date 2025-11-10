// @ts-nocheck - TODO: Fix type errors
// Consolidated Hugo AI, Conversations & Hugo Love API Handler
// Handles: POST /api/v1/hugo/chat
//          POST /api/v1/hugo/knowledge/search
//          POST /api/v1/conversations (create)
//          GET /api/v1/conversations (list)
//          GET /api/v1/conversations/:id (get)
//          DELETE /api/v1/conversations/:id (delete)
//          POST /api/v1/hugo-love/swipe (T058 - FotoFlash)
//          POST /api/v1/hugo-love/ratings (T059 - RateTheBait)
//          GET /api/v1/hugo-love/matches (T060 - CatchTheMatch)
//          GET /api/v1/hugo-love/matches/:matchId
//          POST /api/v1/hugo-love/block
//          DELETE /api/v1/hugo-love/block/:blockedUserId
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

// ============================================================================
// Hugo Love Features (T058-T060)
// ============================================================================

/**
 * T058 - FotoFlash: Record a swipe action (like/dislike/review)
 * POST /api/v1/hugo-love/swipe
 */
async function handleSwipe(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { targetUserId, direction, timestamp: clientTimestamp } = req.body;

  if (!targetUserId) {
    throw validationError('targetUserId is required');
  }

  if (!direction || !['like', 'dislike', 'review'].includes(direction)) {
    throw validationError('direction must be "like", "dislike", or "review"');
  }

  if (userId === targetUserId) {
    throw validationError('Cannot swipe on yourself');
  }

  const supabase = getSupabaseClient();
  const timestamp = clientTimestamp || new Date().toISOString();

  const { data: swipeData, error: swipeError } = await supabase
    .from('hugo_love_swipes')
    .insert({
      user_id: userId,
      target_user_id: targetUserId,
      direction,
      timestamp,
    })
    .select()
    .single();

  if (swipeError || !swipeData) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to record swipe'
        : `Failed to record swipe: ${swipeError?.message}`;
    throw new Error(errorMessage);
  }

  let match = null;
  if (direction === 'like') {
    const { data: priorLike } = await supabase
      .from('hugo_love_swipes')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('target_user_id', userId)
      .eq('direction', 'like')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (priorLike) {
      const [smaller, larger] = [userId, targetUserId].sort();
      const { data: matchData } = await supabase
        .from('hugo_love_matches')
        .select('id, conversation_id')
        .eq('user_id_1', smaller)
        .eq('user_id_2', larger)
        .single();

      if (matchData) {
        match = {
          matchId: matchData.id,
          conversationId: matchData.conversation_id,
        };
      }
    }
  }

  res.status(201).json({
    success: true,
    swipeId: swipeData.id,
    match,
  });
}

/**
 * T059 - RateTheBait: Submit a rating for a user
 * POST /api/v1/hugo-love/ratings
 */
async function handleRating(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { ratedUserId, looks, personality, interests, lifestyle, comment } = req.body;

  if (!ratedUserId) {
    throw validationError('ratedUserId is required');
  }

  if (userId === ratedUserId) {
    throw validationError('Cannot rate yourself');
  }

  const ratings = { looks, personality, interests, lifestyle };
  for (const [field, value] of Object.entries(ratings)) {
    if (typeof value !== 'number' || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw validationError(`${field} must be an integer between 1 and 5`);
    }
  }

  if (comment && typeof comment !== 'string') {
    throw validationError('comment must be a string');
  }

  if (comment && comment.length > 500) {
    throw validationError('comment must not exceed 500 characters');
  }

  const supabase = getSupabaseClient();
  const trimmedComment = comment ? comment.trim() : null;
  const averageScore = parseFloat(((looks + personality + interests + lifestyle) / 4).toFixed(1));

  const { data: ratingData, error: ratingError } = await supabase
    .from('hugo_love_ratings')
    .insert({
      rater_id: userId,
      rated_user_id: ratedUserId,
      looks,
      personality,
      interests,
      lifestyle,
      average_score: averageScore,
      comment: trimmedComment,
    })
    .select()
    .single();

  if (ratingError || !ratingData) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to submit rating'
        : `Failed to submit rating: ${ratingError?.message}`;
    throw new Error(errorMessage);
  }

  const { data: statsData } = await supabase
    .from('hugo_love_ratings')
    .select('id')
    .eq('rated_user_id', ratedUserId);

  const totalRatings = statsData?.length || 0;

  res.status(201).json({
    success: true,
    ratingId: ratingData.id,
    averageScore,
    totalRatings,
  });
}

/**
 * T060 - CatchTheMatch: Retrieve matches for current user
 * GET /api/v1/hugo-love/matches
 */
async function handleGetMatches(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { limit = '50', offset = '0' } = req.query;

  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const supabase = getSupabaseClient();

  const {
    data: matchesData,
    error: matchesError,
    count: totalCount,
  } = await supabase
    .from('hugo_love_matches')
    .select(
      `
      id,
      user_id_1,
      user_id_2,
      conversation_id,
      status,
      created_at
    `,
      { count: 'exact' }
    )
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1);

  if (matchesError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to fetch matches'
        : `Failed to fetch matches: ${matchesError.message}`;
    throw new Error(errorMessage);
  }

  const matches = await Promise.all(
    (matchesData || []).map(async (match) => {
      const otherUserId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('account_id', otherUserId)
        .single();

      return {
        matchId: match.id,
        userId1: match.user_id_1,
        userId2: match.user_id_2,
        conversationId: match.conversation_id,
        status: match.status,
        createdAt: match.created_at,
        matchedProfile: profileData
          ? {
              userId: otherUserId,
              name: profileData.name || 'User',
              avatar: profileData.avatar_url,
            }
          : undefined,
      };
    })
  );

  res.status(200).json({
    success: true,
    matches,
    count: matches.length,
    total: totalCount || 0,
  });
}

/**
 * T060 - CatchTheMatch: Get specific match details
 * GET /api/v1/hugo-love/matches/:matchId
 */
async function handleGetMatch(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { matchId } = req.query;

  if (!matchId) {
    throw validationError('matchId is required');
  }

  const supabase = getSupabaseClient();

  const { data: matchData, error: matchError } = await supabase
    .from('hugo_love_matches')
    .select(
      `
      id,
      user_id_1,
      user_id_2,
      conversation_id,
      status,
      created_at
    `
    )
    .eq('id', matchId)
    .single();

  if (matchError || !matchData) {
    throw notFoundError('Match not found');
  }

  if (matchData.user_id_1 !== userId && matchData.user_id_2 !== userId) {
    throw forbiddenError('You do not have access to this match');
  }

  const otherUserId = matchData.user_id_1 === userId ? matchData.user_id_2 : matchData.user_id_1;
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('account_id', otherUserId)
    .single();

  res.status(200).json({
    matchId: matchData.id,
    userId1: matchData.user_id_1,
    userId2: matchData.user_id_2,
    conversationId: matchData.conversation_id,
    status: matchData.status,
    createdAt: matchData.created_at,
    matchedProfile: profileData
      ? {
          userId: otherUserId,
          name: profileData.name || 'User',
          avatar: profileData.avatar_url,
        }
      : undefined,
  });
}

/**
 * T060 - CatchTheMatch: Block a user
 * POST /api/v1/hugo-love/block
 */
async function handleBlockUser(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { blockedUserId } = req.body;

  if (!blockedUserId) {
    throw validationError('blockedUserId is required');
  }

  if (userId === blockedUserId) {
    throw validationError('Cannot block yourself');
  }

  const supabase = getSupabaseClient();

  const { data: existingBlock } = await supabase
    .from('hugo_love_blocks')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedUserId)
    .single();

  if (existingBlock) {
    res.status(200).json({
      success: true,
      message: 'User already blocked',
    });
    return;
  }

  const { error: blockError } = await supabase.from('hugo_love_blocks').insert({
    blocker_id: userId,
    blocked_id: blockedUserId,
  });

  if (blockError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to block user'
        : `Failed to block user: ${blockError.message}`;
    throw new Error(errorMessage);
  }

  res.status(200).json({
    success: true,
    message: 'User blocked successfully',
  });
}

/**
 * T060 - CatchTheMatch: Unblock a user
 * DELETE /api/v1/hugo-love/block/:blockedUserId
 */
async function handleUnblockUser(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { blockedUserId } = req.query;

  if (!blockedUserId) {
    throw validationError('blockedUserId is required');
  }

  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from('hugo_love_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedUserId);

  if (deleteError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to unblock user'
        : `Failed to unblock user: ${deleteError.message}`;
    throw new Error(errorMessage);
  }

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully',
  });
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

        // Hugo Love endpoints (handles /api/v1/hugo-love)
        if (url?.includes('/hugo-love')) {
          // GET /api/v1/hugo-love/matches/:matchId (check first for specificity)
          const matchIdMatch = url.match(/\/matches\/([^/?]+)$/);
          if (matchIdMatch && method === 'GET') {
            const matchId = matchIdMatch[1];
            authReq.query = { ...authReq.query, matchId };
            return handleGetMatch(authReq, res);
          }

          // GET /api/v1/hugo-love/matches (list all)
          if (url.match(/\/matches$/) && method === 'GET') {
            return handleGetMatches(authReq, res);
          }

          // POST /api/v1/hugo-love/swipe
          if (url.match(/\/swipe$/) && method === 'POST') {
            return handleSwipe(authReq, res);
          }

          // POST /api/v1/hugo-love/ratings
          if (url.match(/\/ratings$/) && method === 'POST') {
            return handleRating(authReq, res);
          }

          // POST /api/v1/hugo-love/block
          if (url.match(/\/block$/) && method === 'POST') {
            return handleBlockUser(authReq, res);
          }

          // DELETE /api/v1/hugo-love/block/:blockedUserId
          const blockMatch = url.match(/\/block\/([^/?]+)$/);
          if (blockMatch && method === 'DELETE') {
            const blockedUserId = blockMatch[1];
            authReq.query = { ...authReq.query, blockedUserId };
            return handleUnblockUser(authReq, res);
          }

          res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
          return;
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
