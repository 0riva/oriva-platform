/**
 * Hugo Love AI Chat Routes
 * POST /api/v1/hugo-love/ai-chat - Start AI coaching session (SSE)
 * GET /api/v1/hugo-love/ai-chat/history - Get chat history
 * POST /api/v1/hugo-love/ai-chat/feedback - Submit feedback
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateAIChatRequest, validateChatFeedbackRequest } from './validation';
import { ValidationError } from '../../utils/validation-express';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/ai-chat
 * Streaming AI coaching with Server-Sent Events
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validated = validateAIChatRequest(req.body);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const supabase = getSupabase(req);

    // Store session
    const { data: session, error: sessionError } = await supabase
      .from('hugo_ai_sessions')
      .insert({
        user_id: userId,
        prompt: validated.prompt,
        context: validated.context,
      })
      .select()
      .single();

    if (sessionError) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to create session' })}\n\n`);
      res.end();
      return;
    }

    // Simulate streaming AI response (replace with actual AI integration)
    const mockResponse =
      'This is a coaching response for your dating profile. Consider highlighting your unique interests and being authentic.';
    const tokens = mockResponse.split(' ');

    for (const token of tokens) {
      res.write(`event: token\ndata: ${JSON.stringify({ text: token + ' ' })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate streaming delay
    }

    // Update session with response
    await supabase.from('hugo_ai_sessions').update({ response: mockResponse }).eq('id', session.id);

    res.write(
      `event: done\ndata: ${JSON.stringify({ messageId: session.id, timestamp: new Date().toISOString() })}\n\n`
    );
    res.end();
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: error.message, code: 'INVALID_INPUT' })}\n\n`
      );
    } else {
      console.error('AI chat endpoint error:', error);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`
      );
    }
    res.end();
  }
});

/**
 * GET /api/v1/hugo-love/ai-chat/history
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabase(req);

    const { data: sessions, error } = await supabase
      .from('hugo_ai_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('AI history fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch history', code: 'SERVER_ERROR' });
      return;
    }

    res.json({ sessions: sessions || [] });
  } catch (error: any) {
    console.error('AI history endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/v1/hugo-love/ai-chat/feedback
 */
router.post('/feedback', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validated = validateChatFeedbackRequest(req.body);

    const supabase = getSupabase(req);

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('hugo_ai_sessions')
      .select('id')
      .eq('id', validated.sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
      return;
    }

    // Update rating
    const { data: updated, error } = await supabase
      .from('hugo_ai_sessions')
      .update({ rating: validated.rating, feedback_comment: validated.comment })
      .eq('id', validated.sessionId)
      .select()
      .single();

    if (error) {
      console.error('Feedback update error:', error);
      res.status(500).json({ error: 'Failed to submit feedback', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      feedbackId: updated.id,
      rating: updated.rating,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Feedback endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

export default router;
