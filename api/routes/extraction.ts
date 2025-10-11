/**
 * Extraction Routes
 * Task: T038
 *
 * API endpoints for GDPR data extraction (Art. 20).
 * Routes: POST /extraction/prepare, POST /extraction/:manifestId/execute, GET /extraction/:manifestId
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication } from '../middleware/auth';
import {
  prepareExtraction,
  executeExtraction,
  getExtraction,
  listExtractions,
  cancelExtraction,
  ExtractionManifestResponse,
} from '../services/extractionService';

const router = Router();

/**
 * POST /api/v1/platform/extraction/prepare
 * Prepare data extraction for user
 */
router.post(
  '/prepare',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const manifest: ExtractionManifestResponse = await prepareExtraction(req, userId);
    res.status(201).json(manifest);
  })
);

/**
 * POST /api/v1/platform/extraction/:manifestId/execute
 * Execute data extraction and generate download
 */
router.post(
  '/:manifestId/execute',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { manifestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const manifest: ExtractionManifestResponse = await executeExtraction(
      req,
      manifestId,
      userId
    );
    res.status(200).json(manifest);
  })
);

/**
 * GET /api/v1/platform/extraction/:manifestId
 * Get extraction manifest status
 */
router.get(
  '/:manifestId',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { manifestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const manifest: ExtractionManifestResponse = await getExtraction(req, manifestId, userId);
    res.status(200).json(manifest);
  })
);

/**
 * GET /api/v1/platform/extraction
 * List user's extraction manifests
 */
router.get(
  '/',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const result = await listExtractions(req, userId);
    res.status(200).json(result);
  })
);

/**
 * DELETE /api/v1/platform/extraction/:manifestId
 * Cancel extraction
 */
router.delete(
  '/:manifestId',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { manifestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    await cancelExtraction(req, manifestId, userId);
    res.status(200).json({ message: 'Extraction cancelled' });
  })
);

export default router;
