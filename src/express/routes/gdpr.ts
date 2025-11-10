/**
 * GDPR Routes
 * Task: T049
 *
 * API endpoints for GDPR compliance operations.
 * Routes: DELETE /users/:userId, GET /users/:userId/deletion-report
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication } from '../middleware/auth';
import {
  deleteUserData,
  verifyDeletionEligibility,
  generateDeletionReport,
  scheduleDeletion,
  DeletionResult,
} from '../../services/gdprService';

const router = Router();

/**
 * GET /api/v1/platform/users/:userId/deletion-eligibility
 * Verify user deletion eligibility
 */
router.get(
  '/:userId/deletion-eligibility',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const result = await verifyDeletionEligibility(req, userId);
    res.status(200).json(result);
  })
);

/**
 * GET /api/v1/platform/users/:userId/deletion-report
 * Generate GDPR deletion report
 */
router.get(
  '/:userId/deletion-report',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const report = await generateDeletionReport(req, userId);
    res.status(200).json(report);
  })
);

/**
 * DELETE /api/v1/platform/users/:userId
 * Delete user data (GDPR Art. 17 - Right to Erasure)
 */
router.delete(
  '/:userId',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { confirmation } = req.body;

    if (!confirmation) {
      res.status(400).json({
        code: 'MISSING_CONFIRMATION',
        message: 'Confirmation token required for user deletion',
      });
      return;
    }

    const result: DeletionResult = await deleteUserData(req, userId, confirmation);
    res.status(200).json(result);
  })
);

/**
 * POST /api/v1/platform/users/:userId/schedule-deletion
 * Schedule user deletion for future date
 */
router.post(
  '/:userId/schedule-deletion',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { deletion_date } = req.body;

    if (!deletion_date) {
      res.status(400).json({
        code: 'MISSING_DELETION_DATE',
        message: 'Deletion date required for scheduled deletion',
      });
      return;
    }

    const schedule = await scheduleDeletion(req, userId, deletion_date);
    res.status(201).json(schedule);
  })
);

export default router;
