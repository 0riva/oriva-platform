// Task: T048-T049 - Get and delete conversation by ID
// Description: Individual conversation operations

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, validationError, notFoundError, forbiddenError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { getSupabaseClient } from '../../config/supabase';

async function getConversationHandler(
  req: AuthenticatedRequest,
  res: VercelResponse,
  conversationId: string,
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  // Get conversation with messages
  const { data: conversation, error: convError } = await supabase
    .from('hugo_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw notFoundError('Conversation');
  }

  // Verify ownership
  if (conversation.user_id !== userId) {
    throw forbiddenError('Access to this conversation is forbidden');
  }

  // Get messages
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

async function deleteConversationHandler(
  req: AuthenticatedRequest,
  res: VercelResponse,
  conversationId: string,
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  // Get conversation to verify ownership
  const { data: conversation, error: convError } = await supabase
    .from('hugo_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw notFoundError('Conversation');
  }

  // Verify ownership
  if (conversation.user_id !== userId) {
    throw forbiddenError('Access to this conversation is forbidden');
  }

  // Delete conversation (CASCADE will delete messages)
  const { error: deleteError } = await supabase
    .from('hugo_conversations')
    .delete()
    .eq('id', conversationId);

  if (deleteError) {
    throw new Error(`Failed to delete conversation: ${deleteError.message}`);
  }

  res.status(204).send('');
}

async function conversationByIdHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Extract ID from URL
  const conversationId = req.url?.split('/').pop() || '';

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    throw validationError('conversation_id must be a valid UUID');
  }

  if (req.method === 'GET') {
    await getConversationHandler(req as AuthenticatedRequest, res, conversationId);
  } else if (req.method === 'DELETE') {
    await deleteConversationHandler(req as AuthenticatedRequest, res, conversationId);
  } else {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(conversationByIdHandler)(req, res);
    });
  });
}