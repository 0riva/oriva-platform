/**
 * Ask Me Anything Votes Router
 * Handles upvoting/downvoting questions
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../middleware/schemaRouter';
import { sendSuccess, sendError, sendNotFound } from '../../utils/response';
import { validateUuid } from '../../utils/validation-express';
import { validateVoteRequest } from './validation';

const router = Router();

// Schema name for AMA tables
const AMA_SCHEMA = 'ask_me_anything';

/**
 * POST /votes
 * Create or update a vote on a question
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    const validated = validateVoteRequest(req.body);

    // Verify the question exists
    const { data: question, error: questionError } = await supabase
      .schema(AMA_SCHEMA)
      .from('questions')
      .select('id, vote_count')
      .eq('id', validated.questionId)
      .single();

    if (questionError || !question) {
      return sendNotFound(res, 'Question not found');
    }

    // Check for existing vote
    const { data: existingVote, error: voteCheckError } = await supabase
      .schema(AMA_SCHEMA)
      .from('votes')
      .select('id, vote_value')
      .eq('question_id', validated.questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (voteCheckError) {
      console.error('Error checking existing vote:', voteCheckError);
      return sendError(res, 'Failed to check existing vote', 500);
    }

    let voteCountChange = validated.voteValue;

    if (existingVote) {
      // Update existing vote
      if (existingVote.vote_value === validated.voteValue) {
        // Same vote value, no change needed
        return sendSuccess(res, {
          success: true,
          newVoteCount: question.vote_count,
          message: 'Vote already recorded',
        });
      }

      // Vote is changing direction (e.g., upvote to downvote)
      // Change is double the vote value (remove old vote + add new vote)
      voteCountChange = validated.voteValue * 2;

      const { error: updateError } = await supabase
        .schema(AMA_SCHEMA)
        .from('votes')
        .update({
          vote_value: validated.voteValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVote.id);

      if (updateError) {
        console.error('Error updating vote:', updateError);
        return sendError(res, 'Failed to update vote', 500);
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase.schema(AMA_SCHEMA).from('votes').insert({
        question_id: validated.questionId,
        user_id: userId,
        vote_value: validated.voteValue,
      });

      if (insertError) {
        console.error('Error creating vote:', insertError);
        return sendError(res, 'Failed to create vote', 500);
      }
    }

    // Update the question's vote_count
    const newVoteCount = question.vote_count + voteCountChange;
    const { error: updateQuestionError } = await supabase
      .schema(AMA_SCHEMA)
      .from('questions')
      .update({ vote_count: newVoteCount })
      .eq('id', validated.questionId);

    if (updateQuestionError) {
      console.error('Error updating question vote count:', updateQuestionError);
      // Vote was recorded, but count update failed - log but don't fail
    }

    return sendSuccess(res, {
      success: true,
      newVoteCount,
    });
  } catch (error) {
    console.error('Error in POST /votes:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * DELETE /votes/:questionId
 * Remove a vote from a question
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

    // Get the existing vote
    const { data: existingVote, error: voteError } = await supabase
      .schema(AMA_SCHEMA)
      .from('votes')
      .select('id, vote_value')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (voteError) {
      console.error('Error fetching vote:', voteError);
      return sendError(res, 'Failed to fetch vote', 500);
    }

    if (!existingVote) {
      return sendNotFound(res, 'Vote not found');
    }

    // Delete the vote
    const { error: deleteError } = await supabase
      .schema(AMA_SCHEMA)
      .from('votes')
      .delete()
      .eq('id', existingVote.id);

    if (deleteError) {
      console.error('Error deleting vote:', deleteError);
      return sendError(res, 'Failed to delete vote', 500);
    }

    // Update the question's vote_count
    const { data: question } = await supabase
      .schema(AMA_SCHEMA)
      .from('questions')
      .select('vote_count')
      .eq('id', questionId)
      .single();

    if (question) {
      const newVoteCount = question.vote_count - existingVote.vote_value;
      await supabase
        .schema(AMA_SCHEMA)
        .from('questions')
        .update({ vote_count: newVoteCount })
        .eq('id', questionId);
    }

    return sendSuccess(res, { success: true });
  } catch (error) {
    console.error('Error in DELETE /votes/:questionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * GET /votes/:questionId
 * Get the user's vote on a specific question
 */
router.get('/:questionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { questionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    validateUuid(questionId, 'questionId');

    const { data: vote, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('votes')
      .select('vote_value')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching vote:', error);
      return sendError(res, 'Failed to fetch vote', 500);
    }

    return sendSuccess(res, {
      hasVoted: !!vote,
      voteValue: vote?.vote_value || null,
    });
  } catch (error) {
    console.error('Error in GET /votes/:questionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

export default router;
