/**
 * Call Transcripts Routes
 * BFF API endpoints for the call transcription workflow
 *
 * POST /api/v1/travel-hub/transcripts/consent - Record client consent
 * POST /api/v1/travel-hub/transcripts/recording/start - Start call recording
 * POST /api/v1/travel-hub/transcripts/recording/stop - Stop call recording
 * GET  /api/v1/travel-hub/transcripts - List transcripts (with filters)
 * GET  /api/v1/travel-hub/transcripts/:id - Get single transcript
 * POST /api/v1/travel-hub/transcripts/:id/confirm - Confirm transcript
 * POST /api/v1/travel-hub/transcripts/:id/reject - Reject transcript
 * GET  /api/v1/travel-hub/transcripts/:id/audio-url - Get audio playback URL
 * GET  /api/v1/travel-hub/transcripts/stats/client/:clientId - Get client transcript stats
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { callTranscriptionService } from '../../../services/callTranscription/callTranscriptionService';
import { logger } from '../../../utils/logger';
import type { TranscriptStatus, ConsentMethod } from '../../../services/callTranscription/types';

const router = Router();

// Validation middleware helper
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

// Helper to extract access token from request
const getAccessToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
};

// ============================================================================
// Consent Endpoints
// ============================================================================

/**
 * POST /api/v1/travel-hub/transcripts/consent
 * Record client consent for call recording
 */
router.post(
  '/consent',
  [
    body('organization_id').isUUID(),
    body('client_id').isUUID(),
    body('consented_by').isUUID(), // The user who gave consent (client's profile_id)
    body('consent_method').isIn(['verbal', 'written', 'electronic', 'implied']),
    body('consent_language').optional().isString().isLength({ max: 10 }),
    body('consent_text').optional().isString().isLength({ max: 2000 }),
    body('ip_address').optional().isIP(),
    body('metadata').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const accessToken = getAccessToken(req);
      const result = await callTranscriptionService.recordConsent(req.body, userId, accessToken);

      if (!result.success) {
        logger.error('[TranscriptsRoute] Consent recording failed', { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      logger.info('[TranscriptsRoute] Consent recorded', {
        consentId: result.data?.id,
        clientId: req.body.client_id,
      });

      res.status(201).json({ ok: true, data: result.data });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in consent', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

// ============================================================================
// Recording Control Endpoints
// ============================================================================

/**
 * POST /api/v1/travel-hub/transcripts/recording/start
 * Start recording a call
 */
router.post(
  '/recording/start',
  [body('consent_id').isUUID(), body('call_sid').isString().isLength({ min: 1, max: 64 })],
  validate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { consent_id, call_sid } = req.body;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.startRecording(
        consent_id,
        call_sid,
        userId,
        accessToken
      );

      if (!result.success) {
        logger.error('[TranscriptsRoute] Start recording failed', { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      logger.info('[TranscriptsRoute] Recording started', {
        transcriptId: result.data?.id,
        callSid: call_sid,
      });

      res.status(201).json({ ok: true, data: result.data });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in start recording', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/transcripts/recording/stop
 * Stop recording a call
 */
router.post(
  '/recording/stop',
  [body('transcript_id').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { transcript_id } = req.body;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.stopRecording(
        transcript_id,
        userId,
        accessToken
      );

      if (!result.success) {
        logger.error('[TranscriptsRoute] Stop recording failed', { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      logger.info('[TranscriptsRoute] Recording stopped', { transcriptId: transcript_id });

      res.json({ ok: true, message: 'Recording stopped' });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in stop recording', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

// ============================================================================
// Transcript CRUD Endpoints
// ============================================================================

/**
 * GET /api/v1/travel-hub/transcripts
 * List transcripts with filtering
 */
router.get(
  '/',
  [
    query('organization_id').optional().isUUID(),
    query('client_id').optional().isUUID(),
    query('concierge_id').optional().isUUID(),
    query('status')
      .optional()
      .isIn([
        'pending_consent',
        'consent_granted',
        'recording',
        'processing',
        'transcribing',
        'summarizing',
        'ready',
        'confirmed',
        'failed',
        'expired',
      ] as TranscriptStatus[]),
    query('from_date').optional().isISO8601(),
    query('to_date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const accessToken = getAccessToken(req);

      const filters = {
        organizationId: req.query.organization_id as string | undefined,
        clientId: req.query.client_id as string | undefined,
        conciergeId: req.query.concierge_id as string | undefined,
        status: req.query.status as TranscriptStatus | undefined,
        fromDate: req.query.from_date as string | undefined,
        toDate: req.query.to_date as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const result = await callTranscriptionService.getTranscripts(filters, accessToken);

      if (!result.success) {
        logger.error('[TranscriptsRoute] List transcripts failed', { error: result.error });
        return res.status(500).json({ ok: false, error: result.error });
      }

      res.json({
        ok: true,
        data: result.data?.transcripts || [],
        pagination: {
          total: result.data?.total || 0,
          limit: filters.limit || 20,
          offset: filters.offset || 0,
        },
      });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/transcripts/:id
 * Get single transcript
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const accessToken = getAccessToken(req);

    const result = await callTranscriptionService.getTranscript(id, accessToken);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return res.status(404).json({ ok: false, error: 'Transcript not found' });
      }
      logger.error('[TranscriptsRoute] Get transcript failed', { error: result.error, id });
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.json({ ok: true, data: result.data });
  } catch (error: any) {
    logger.error('[TranscriptsRoute] Unexpected error in get', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// ============================================================================
// Transcript Actions
// ============================================================================

/**
 * POST /api/v1/travel-hub/transcripts/:id/confirm
 * Confirm transcript accuracy (triggers audio deletion)
 */
router.post(
  '/:id/confirm',
  [
    param('id').isUUID(),
    body('notes').optional().isString().isLength({ max: 2000 }),
    body('extracted_requirements').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { notes, extracted_requirements } = req.body;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.confirmTranscript(
        {
          transcriptId: id,
          confirmedBy: userId,
          notes,
          extractedRequirements: extracted_requirements,
        },
        accessToken
      );

      if (!result.success) {
        logger.error('[TranscriptsRoute] Confirm failed', { error: result.error, id });
        return res.status(500).json({ ok: false, error: result.error });
      }

      logger.info('[TranscriptsRoute] Transcript confirmed', {
        transcriptId: id,
        confirmedBy: userId,
      });

      res.json({ ok: true, message: 'Transcript confirmed' });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in confirm', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/transcripts/:id/reject
 * Reject transcript for re-review
 */
router.post(
  '/:id/reject',
  [
    param('id').isUUID(),
    body('reason').isString().isLength({ min: 1, max: 2000 }),
    body('request_retranscription').optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason, request_retranscription } = req.body;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.rejectTranscript(
        {
          transcriptId: id,
          rejectedBy: userId,
          reason,
          requestRetranscription: request_retranscription,
        },
        accessToken
      );

      if (!result.success) {
        logger.error('[TranscriptsRoute] Reject failed', { error: result.error, id });
        return res.status(500).json({ ok: false, error: result.error });
      }

      logger.info('[TranscriptsRoute] Transcript rejected', {
        transcriptId: id,
        rejectedBy: userId,
        reason,
      });

      res.json({ ok: true, message: 'Transcript rejected' });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in reject', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/transcripts/:id/audio-url
 * Get pre-signed URL for audio playback
 */
router.get(
  '/:id/audio-url',
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.getAudioPlaybackUrl(id, accessToken);

      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ ok: false, error: 'Transcript not found' });
        }
        if (result.error?.includes('not available')) {
          return res.status(404).json({ ok: false, error: 'Audio not available' });
        }
        logger.error('[TranscriptsRoute] Get audio URL failed', { error: result.error, id });
        return res.status(500).json({ ok: false, error: result.error });
      }

      res.json({ ok: true, data: result.data });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in audio-url', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

// ============================================================================
// Statistics Endpoints
// ============================================================================

/**
 * GET /api/v1/travel-hub/transcripts/stats/client/:clientId
 * Get transcript stats for a client
 */
router.get(
  '/stats/client/:clientId',
  [param('clientId').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const accessToken = getAccessToken(req);

      const result = await callTranscriptionService.getClientTranscriptStats(clientId, accessToken);

      if (!result.success) {
        logger.error('[TranscriptsRoute] Get client stats failed', {
          error: result.error,
          clientId,
        });
        return res.status(500).json({ ok: false, error: result.error });
      }

      res.json({ ok: true, data: result.data });
    } catch (error: any) {
      logger.error('[TranscriptsRoute] Unexpected error in stats', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
