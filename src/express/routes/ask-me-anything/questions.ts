/**
 * Ask Me Anything Questions Router
 * Handles question submission, retrieval, and moderation
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../middleware/schemaRouter';
import { sendSuccess, sendError, sendNotFound } from '../../utils/response';
import { validateUuid } from '../../utils/validation-express';
import {
  validateSubmitQuestionRequest,
  validateUpdateQuestionRequest,
  validatePagination,
  validateQuestionFilter,
} from './validation';

const router = Router();

// Schema name for AMA tables
const AMA_SCHEMA = 'ask_me_anything';

/**
 * GET /questions
 * Get questions for an AMA session with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return sendError(res, 'sessionId query parameter is required', 400);
    }

    validateUuid(sessionId, 'sessionId');

    const { limit, offset } = validatePagination(req.query);
    const filter = validateQuestionFilter(req.query);

    let query = supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .select('*', { count: 'exact' })
      .eq('ama_session_id', sessionId)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filter.filter === 'highlighted') {
      query = query.eq('is_highlighted', true);
    } else if (filter.filter === 'answered') {
      query = query.eq('is_answered', true);
    } else if (filter.filter === 'unanswered') {
      query = query.eq('is_answered', false);
    }

    // Only show approved questions by default (unless host)
    query = query.eq('moderation_status', 'approved');

    const { data: questions, error, count } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return sendError(res, 'Failed to fetch questions', 500);
    }

    return sendSuccess(res, {
      questions: questions || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /questions:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * GET /questions/:questionId
 * Get a specific question by ID
 */
router.get('/:questionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { questionId } = req.params;

    validateUuid(questionId, 'questionId');

    const { data: question, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendNotFound(res, 'Question not found');
      }
      console.error('Error fetching question:', error);
      return sendError(res, 'Failed to fetch question', 500);
    }

    return sendSuccess(res, { question });
  } catch (error) {
    console.error('Error in GET /questions/:questionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * POST /questions
 * Submit a new question to an AMA session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    const validated = validateSubmitQuestionRequest(req.body);

    // Verify the session exists and is accepting questions
    const { data: session, error: sessionError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('id, status')
      .eq('id', validated.amaSessionId)
      .single();

    if (sessionError || !session) {
      return sendNotFound(res, 'AMA session not found');
    }

    if (session.status === 'ended' || session.status === 'deleted') {
      return sendError(res, 'This AMA session is no longer accepting questions', 400);
    }

    // Build the question data
    const questionData: Record<string, unknown> = {
      ama_session_id: validated.amaSessionId,
      question_text: validated.questionText,
      is_anonymous: validated.isAnonymous,
      moderation_status: 'pending', // All questions start as pending
      vote_count: 0,
    };

    // Set author information
    if (userId && !validated.isAnonymous) {
      questionData.author_id = userId;
    }
    if (validated.profileId) {
      questionData.profile_id = validated.profileId;
    }

    const { data: question, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .insert(questionData)
      .select()
      .single();

    if (error) {
      console.error('Error submitting question:', error);
      return sendError(res, 'Failed to submit question', 500);
    }

    return sendSuccess(res, { question }, 201);
  } catch (error) {
    console.error('Error in POST /questions:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * PATCH /questions/:questionId
 * Update a question (for host moderation actions)
 */
router.patch('/:questionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { questionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    validateUuid(questionId, 'questionId');

    // Get the question and verify the user is the session host
    const { data: question, error: fetchError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .select('ama_session_id')
      .eq('id', questionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return sendNotFound(res, 'Question not found');
      }
      console.error('Error fetching question:', fetchError);
      return sendError(res, 'Failed to fetch question', 500);
    }

    // Verify the user is the session host
    const { data: session, error: sessionError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('account_id')
      .eq('id', question.ama_session_id)
      .single();

    if (sessionError || !session) {
      return sendError(res, 'Failed to verify session ownership', 500);
    }

    if (session.account_id !== userId) {
      return sendError(res, 'Not authorized to update this question', 403);
    }

    const updates = validateUpdateQuestionRequest(req.body);

    // Convert to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.isHighlighted !== undefined) dbUpdates.is_highlighted = updates.isHighlighted;
    if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
    if (updates.isAnswered !== undefined) dbUpdates.is_answered = updates.isAnswered;
    if (updates.moderationStatus) dbUpdates.moderation_status = updates.moderationStatus;
    if (updates.answerText !== undefined) {
      dbUpdates.answer_text = updates.answerText;
      dbUpdates.answered_at = updates.answeredAt;
      dbUpdates.is_answered = true;
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { data: updatedQuestion, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .update(dbUpdates)
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating question:', error);
      return sendError(res, 'Failed to update question', 500);
    }

    return sendSuccess(res, { question: updatedQuestion });
  } catch (error) {
    console.error('Error in PATCH /questions/:questionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * DELETE /questions/:questionId
 * Delete a question (soft delete by setting moderation_status to 'rejected')
 */
router.delete('/:questionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { questionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    validateUuid(questionId, 'questionId');

    // Get the question
    const { data: question, error: fetchError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .select('ama_session_id, author_id')
      .eq('id', questionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return sendNotFound(res, 'Question not found');
      }
      console.error('Error fetching question:', fetchError);
      return sendError(res, 'Failed to fetch question', 500);
    }

    // Check if user is author or session host
    const isAuthor = question.author_id === userId;

    if (!isAuthor) {
      // Check if user is session host
      const { data: session, error: sessionError } = await supabase
        .schema(AMA_SCHEMA)
        .from('ama_sessions')
        .select('account_id')
        .eq('id', question.ama_session_id)
        .single();

      if (sessionError || !session || session.account_id !== userId) {
        return sendError(res, 'Not authorized to delete this question', 403);
      }
    }

    // Soft delete by setting moderation_status to rejected
    const { error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_questions')
      .update({
        moderation_status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      return sendError(res, 'Failed to delete question', 500);
    }

    return sendSuccess(res, { message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /questions/:questionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

export default router;
