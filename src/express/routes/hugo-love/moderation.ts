/**
 * Hugo Love Moderation Routes
 * POST /api/v1/hugo-love/reports - Submit a report
 * GET /api/v1/hugo-love/reports/my-reports - Get user's reports
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateReportRequest } from './validation';
import { ValidationError } from '../../utils/validation-express';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/reports
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - reports are filed from the selected profile
    const reporterId = req.profileId || req.user!.id;
    const validated = validateReportRequest(req.body);

    if (reporterId === validated.reportedUserId) {
      throw new ValidationError('Cannot report yourself', { field: 'reportedUserId' });
    }

    const supabase = getSupabase(req);

    const { data: report, error } = await supabase
      .from('hugo_reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: validated.reportedUserId,
        reason: validated.reason,
        description: validated.description,
        evidence_urls: validated.evidenceUrls,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Report creation error:', error);
      res.status(500).json({ error: 'Failed to submit report', code: 'SERVER_ERROR' });
      return;
    }

    res.status(201).json({
      reportId: report.id,
      status: 'pending',
      submittedAt: report.created_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Report endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/reports/my-reports
 */
router.get('/my-reports', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - view reports from selected profile
    const reporterId = req.profileId || req.user!.id;
    const supabase = getSupabase(req);

    const { data: reports, error } = await supabase
      .from('hugo_reports')
      .select('*')
      .eq('reporter_id', reporterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Reports fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch reports', code: 'SERVER_ERROR' });
      return;
    }

    res.json({ reports: reports || [] });
  } catch (error: any) {
    console.error('My reports endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
