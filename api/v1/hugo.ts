// @ts-nocheck - TODO: Fix type errors
// Consolidated Hugo API Handler
// Handles: POST /api/v1/hugo/chat
//          POST /api/v1/hugo/knowledge/search
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import { asyncHandler, validationError } from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
import { composeChatContext, buildSystemPrompt, saveMessage } from '../../src/services/chat';
import { searchKnowledge } from '../../src/services/knowledge';
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;
        const { url, method } = req;

        if (method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
          return;
        }

        // POST /api/v1/hugo/knowledge/search (check first to avoid matching /chat)
        if (url?.match(/\/knowledge\/search$/)) {
          return handleKnowledgeSearch(authReq, res);
        }

        // POST /api/v1/hugo/chat
        if (url?.match(/\/chat$/)) {
          return handleChat(authReq, res);
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
