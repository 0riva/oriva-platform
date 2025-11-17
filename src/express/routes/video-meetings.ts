/**
 * Video Meetings Router
 * Handles CRUD operations for video meetings
 * Pattern: Multi-tenant app using video_meetings schema
 */
import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../types/middleware/auth';

const router = Router();

// Create Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Simple auth middleware that validates Bearer token exists
const simpleAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      success: false,
      error: 'Unauthorized',
      message: 'Authorization header required with Bearer token',
      code: 'UNAUTHORIZED',
    });
  }

  next();
};

// Apply simple auth to all routes
router.use(simpleAuth);
/**
 * GET /api/v1/video-meetings/meetings
 * Fetch all meetings for authenticated user
 */
router.get('/meetings', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        message: 'Account ID not found',
        code: 'UNAUTHORIZED',
      });
    }
    // Query meetings from video_meetings schema
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(500).json({
        ok: false,
        success: false,
        error: 'Database error',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('[video-meetings] Error fetching meetings:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * GET /api/v1/video-meetings/meetings/:meetingId
 * Fetch single meeting by ID
 */
router.get('/meetings/:meetingId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    const { meetingId } = req.params;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('account_id', accountId)
      .single();
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(404).json({
        ok: false,
        success: false,
        error: 'Meeting not found',
        code: 'NOT_FOUND',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      data,
    });
  } catch (error) {
    console.error('[video-meetings] Error fetching meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * POST /api/v1/video-meetings/meetings
 * Create new meeting
 */
router.post('/meetings', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const meetingData = {
      account_id: accountId,
      ...req.body,
    };
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .insert(meetingData)
      .select()
      .single();
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'Failed to create meeting',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(201).json({
      ok: true,
      success: true,
      data,
    });
  } catch (error) {
    console.error('[video-meetings] Error creating meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * PATCH /api/v1/video-meetings/meetings/:meetingId
 * Update existing meeting
 */
router.patch('/meetings/:meetingId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    const { meetingId } = req.params;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .update(req.body)
      .eq('id', meetingId)
      .eq('account_id', accountId)
      .select()
      .single();
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'Failed to update meeting',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      data,
    });
  } catch (error) {
    console.error('[video-meetings] Error updating meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * DELETE /api/v1/video-meetings/meetings/:meetingId
 * Delete meeting
 */
router.delete('/meetings/:meetingId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    const { meetingId } = req.params;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { error } = await supabase
      .from('video_meetings.meetings')
      .delete()
      .eq('id', meetingId)
      .eq('account_id', accountId);
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'Failed to delete meeting',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error) {
    console.error('[video-meetings] Error deleting meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * POST /api/v1/video-meetings/meetings/:meetingId/start
 * Start meeting (update status to 'active')
 */
router.post('/meetings/:meetingId/start', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    const { meetingId } = req.params;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .update({ status: 'active' })
      .eq('id', meetingId)
      .eq('account_id', accountId)
      .select()
      .single();
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'Failed to start meeting',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      data,
    });
  } catch (error) {
    console.error('[video-meetings] Error starting meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
/**
 * POST /api/v1/video-meetings/meetings/:meetingId/end
 * End meeting (update status to 'ended')
 */
router.post('/meetings/:meetingId/end', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const accountId = authReq.keyInfo?.userId;
    const { meetingId } = req.params;
    if (!accountId) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }
    const { data, error } = await supabase
      .from('video_meetings.meetings')
      .update({ status: 'ended' })
      .eq('id', meetingId)
      .eq('account_id', accountId)
      .select()
      .single();
    if (error) {
      console.error('[video-meetings] Database error:', error);
      return res.status(400).json({
        ok: false,
        success: false,
        error: 'Failed to end meeting',
        message: error.message,
        code: 'DATABASE_ERROR',
      });
    }
    return res.status(200).json({
      ok: true,
      success: true,
      data,
    });
  } catch (error) {
    console.error('[video-meetings] Error ending meeting:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
export default router;
