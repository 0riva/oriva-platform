// Task: T045 - Chat endpoint with streaming SSE
// Description: Multi-layered AI chat with real-time token streaming

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { composeChatContext, buildSystemPrompt, saveMessage } from '../../services/chat';
import OpenAI from 'openai';

interface ChatRequest {
  conversation_id: string;
  message: string;
  context?: {
    current_goals?: string[];
    metadata?: Record<string, unknown>;
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chatHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const startTime = Date.now();

  // Get app ID from header
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { userId } = req.authContext;
  const { conversation_id, message, context: additionalContext }: ChatRequest = req.body;

  // Validation
  if (!conversation_id) {
    throw validationError('conversation_id is required');
  }

  if (!message || message.trim().length === 0) {
    throw validationError('message cannot be empty');
  }

  if (message.length > 5000) {
    throw validationError('message exceeds maximum length of 5000 characters');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversation_id)) {
    throw validationError('conversation_id must be a valid UUID');
  }

  // Verify conversation ownership and existence
  // This will throw 403 if user doesn't own conversation, 404 if not found
  await verifyConversationAccess(conversation_id, userId);

  // Save user message
  await saveMessage({
    conversationId: conversation_id,
    role: 'user',
    content: message,
  });

  // Compose context from all layers
  const composedContext = await composeChatContext({
    appId,
    userId,
    conversationId: conversation_id,
    message,
    additionalContext,
  });

  // Build system prompt
  const systemPrompt = buildSystemPrompt(composedContext);

  // Build conversation messages
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...composedContext.history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
    temperature: 0.7,
  });

  let fullResponse = '';
  let tokenCount = 0;

  try {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        tokenCount++;

        // Send token event
        res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
      }
    }

    const endTime = Date.now();
    const generationTimeMs = endTime - startTime;

    // Save assistant response
    const messageId = await saveMessage({
      conversationId: conversation_id,
      role: 'assistant',
      content: fullResponse,
      model: 'gpt-4',
      confidenceScore: 0.85, // TODO: Calculate actual confidence
      generationTimeMs,
      tokensUsed: tokenCount,
    });

    // Send done event
    const doneEvent = {
      type: 'done',
      message_id: messageId,
      confidence: 0.85,
      knowledge_sources: composedContext.knowledge.map((k) => ({
        title: k.title,
        relevance_score: k.relevance_score,
      })),
    };

    res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
    res.end();
  } catch (error) {
    // Send error event
    const errorEvent = {
      type: 'error',
      content: 'An error occurred while generating response',
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
}

/**
 * Verify user has access to conversation
 */
async function verifyConversationAccess(conversationId: string, userId: string): Promise<void> {
  const { getSupabaseClient } = await import('../../config/supabase');
  const { notFoundError, forbiddenError } = await import('../../middleware/error-handler');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (error || !data) {
    throw notFoundError('Conversation');
  }

  if (data.user_id !== userId) {
    throw forbiddenError('Access to this conversation is forbidden');
  }
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(chatHandler)(req, res);
    });
  });
}