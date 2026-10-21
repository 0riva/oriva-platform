/**
 * Video Meetings Router
 * Handles CRUD operations for video meetings
 * Pattern: Multi-tenant app using video_meetings schema
 */
import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../types/middleware/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Create Supabase client. Service role bypasses RLS, so every query below filters
// by account_id explicitly to scope data to the authenticated user.
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Whereby Embedded API base — the API key is used server-side only and never reaches the client.
const WHEREBY_API_BASE = 'https://api.whereby.dev/v1';

// Apply shared auth to all routes. requireAuth validates the JWT and populates
// req.keyInfo.userId — the previous local simpleAuth only checked header presence
// and left keyInfo undefined, so every account-scoped query returned 401.
router.use(requireAuth);
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
      .schema('video_meetings')
      .from('meetings')
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
/**
 * POST /api/v1/video-meetings/whereby/rooms
 * Create a Whereby room. The Whereby API key lives only on the server; the client
 * never sees it. Forwards to Whereby's create-meeting endpoint and returns its body.
 */
router.post('/whereby/rooms', async (_req: Request, res: Response) => {
  const apiKey = process.env.WHEREBY_API_KEY;
  if (!apiKey) {
    console.error('[video-meetings] WHEREBY_API_KEY is not configured');
    return res.status(503).json({
      ok: false,
      success: false,
      error: 'Whereby not configured',
      message: 'WHEREBY_API_KEY is not set on the server',
      code: 'WHEREBY_NOT_CONFIGURED',
    });
  }
  try {
    // Whereby requires an endDate; default to 24h out when the client omits it.
    const body = {
      roomMode: _req.body?.roomMode ?? 'group',
      endDate: _req.body?.endDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fields: _req.body?.fields ?? ['hostRoomUrl'],
      isLocked: _req.body?.isLocked ?? false,
      roomNamePrefix: _req.body?.roomNamePrefix ?? '/oriva-meeting-',
      ...(_req.body?.startDate ? { startDate: _req.body.startDate } : {}),
    };
    const wherebyRes = await fetch(`${WHEREBY_API_BASE}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const data = await wherebyRes.json().catch(() => ({}));
    if (!wherebyRes.ok) {
      console.error('[video-meetings] Whereby create room failed:', data);
      return res.status(wherebyRes.status).json({
        ok: false,
        success: false,
        error: 'Failed to create Whereby room',
        message: (data as { message?: string })?.message || 'Whereby API error',
        code: 'WHEREBY_ERROR',
      });
    }
    return res.status(201).json(data);
  } catch (error) {
    console.error('[video-meetings] Error creating Whereby room:', error);
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
 * GET /api/v1/video-meetings/whereby/rooms/:meetingId
 * Fetch a Whereby room's details.
 */
router.get('/whereby/rooms/:meetingId', async (req: Request, res: Response) => {
  const apiKey = process.env.WHEREBY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      success: false,
      error: 'Whereby not configured',
      code: 'WHEREBY_NOT_CONFIGURED',
    });
  }
  try {
    const { meetingId } = req.params;
    const wherebyRes = await fetch(`${WHEREBY_API_BASE}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await wherebyRes.json().catch(() => ({}));
    if (!wherebyRes.ok) {
      return res.status(wherebyRes.status).json({
        ok: false,
        success: false,
        error: 'Failed to get Whereby room',
        message: (data as { message?: string })?.message || 'Whereby API error',
        code: 'WHEREBY_ERROR',
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('[video-meetings] Error fetching Whereby room:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/v1/video-meetings/whereby/rooms/:meetingId
 * Delete a Whereby room.
 */
router.delete('/whereby/rooms/:meetingId', async (req: Request, res: Response) => {
  const apiKey = process.env.WHEREBY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      success: false,
      error: 'Whereby not configured',
      code: 'WHEREBY_NOT_CONFIGURED',
    });
  }
  try {
    const { meetingId } = req.params;
    const wherebyRes = await fetch(`${WHEREBY_API_BASE}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!wherebyRes.ok && wherebyRes.status !== 404) {
      const data = await wherebyRes.json().catch(() => ({}));
      return res.status(wherebyRes.status).json({
        ok: false,
        success: false,
        error: 'Failed to delete Whereby room',
        message: (data as { message?: string })?.message || 'Whereby API error',
        code: 'WHEREBY_ERROR',
      });
    }
    return res.status(200).json({ ok: true, success: true, message: 'Room deleted' });
  } catch (error) {
    console.error('[video-meetings] Error deleting Whereby room:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
