/**
 * Limohawk Scheduled Jobs Handler
 *
 * Cron endpoint for automated loyalty system tasks:
 * - Daily points expiry check
 * - Expiry warning notifications (30/7/1 days)
 *
 * Triggered by Vercel Cron via vercel.json configuration.
 *
 * Security:
 * - Verifies CRON_SECRET header
 * - Only runs from authorized cron requests
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  sendExpiryWarningEmail,
  wasNotificationSent,
  syncLoyaltyAccountToBrevo,
} from '../../src/services/limohawk/brevoService';

// ============================================================================
// Configuration
// ============================================================================

const CRON_SECRET = process.env.LIMOHAWK_CRON_SECRET;

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// Job Types
// ============================================================================

type JobType = 'expire-points' | 'expiry-warnings' | 'monthly-statements';

interface JobResult {
  job: JobType;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only allow GET (Vercel Cron uses GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Verify CRON_SECRET
  const authHeader = req.headers['authorization'];
  const providedSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET) {
    console.error('[LimohawkCron] CRON_SECRET not configured');
    res.status(500).json({ error: 'Cron secret not configured' });
    return;
  }

  if (providedSecret !== CRON_SECRET) {
    console.warn('[LimohawkCron] Invalid cron secret provided');
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  // Determine which job to run based on query param
  const job = (req.query.job as JobType) || 'expire-points';

  console.log(`[LimohawkCron] Running job: ${job}`);

  const results: JobResult[] = [];

  try {
    switch (job) {
      case 'expire-points':
        results.push(await runExpirePointsJob());
        break;

      case 'expiry-warnings':
        results.push(await runExpiryWarningsJob());
        break;

      case 'monthly-statements':
        results.push(await runMonthlyStatementsJob());
        break;

      default:
        res.status(400).json({ error: `Unknown job: ${job}`, code: 'INVALID_JOB' });
        return;
    }

    const allSuccessful = results.every((r) => r.success);

    res.status(allSuccessful ? 200 : 207).json({
      success: allSuccessful,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LimohawkCron] Job ${job} failed:`, error);
    res.status(500).json({
      success: false,
      error: errorMessage,
      job,
    });
  }
}

// ============================================================================
// Job: Expire Points
// ============================================================================

/**
 * Expire points for accounts inactive for 12 months
 */
async function runExpirePointsJob(): Promise<JobResult> {
  const supabase = getSupabaseServiceClient();

  try {
    // Call the stored function
    const { data, error } = await supabase.rpc('limohawk.expire_inactive_points');

    if (error) {
      console.error('[LimohawkCron] expire_inactive_points error:', error);
      return {
        job: 'expire-points',
        success: false,
        details: {},
        error: error.message,
      };
    }

    const result = data?.[0] || { accounts_expired: 0, points_expired: 0 };

    console.log(
      `[LimohawkCron] Expired ${result.points_expired} points from ${result.accounts_expired} accounts`
    );

    return {
      job: 'expire-points',
      success: true,
      details: {
        accountsExpired: result.accounts_expired,
        pointsExpired: result.points_expired,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      job: 'expire-points',
      success: false,
      details: {},
      error: errorMessage,
    };
  }
}

// ============================================================================
// Job: Expiry Warnings
// ============================================================================

/**
 * Send expiry warning emails to accounts approaching 12-month inactivity
 */
async function runExpiryWarningsJob(): Promise<JobResult> {
  const supabase = getSupabaseServiceClient();

  const warningDays = [30, 7, 1];
  const results = {
    checked: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    for (const days of warningDays) {
      // Get accounts expiring in approximately `days` days
      // Calculate the date range (e.g., for 30 days warning, check accounts
      // whose last_activity was 335-336 days ago)
      const expiryMonths = 12;
      const targetDaysAgo = expiryMonths * 30 - days;

      const rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - targetDaysAgo - 1);

      const rangeEnd = new Date();
      rangeEnd.setDate(rangeEnd.getDate() - targetDaysAgo);

      const { data: accounts, error } = await supabase
        .from('limohawk.loyalty_accounts')
        .select('id, email, name, points_balance, last_activity_at')
        .gte('last_activity_at', rangeStart.toISOString())
        .lt('last_activity_at', rangeEnd.toISOString())
        .gt('points_balance', 0);

      if (error) {
        console.error(`[LimohawkCron] Error fetching accounts for ${days}-day warning:`, error);
        continue;
      }

      if (!accounts || accounts.length === 0) {
        continue;
      }

      for (const account of accounts) {
        results.checked++;

        // Check if we already sent this warning
        const notificationType = `expiry_warning_${days}`;
        const alreadySent = await wasNotificationSent(account.id, notificationType, 24 * 7); // 7 days

        if (alreadySent) {
          results.skipped++;
          continue;
        }

        // Send warning email
        const emailResult = await sendExpiryWarningEmail(
          account.id,
          account.email,
          account.name,
          account.points_balance,
          days
        );

        if (emailResult.success) {
          results.sent++;

          // Sync to Brevo
          await syncLoyaltyAccountToBrevo(account.id);
        } else {
          results.errors++;
          console.error(
            `[LimohawkCron] Failed to send ${days}-day warning to ${account.email}:`,
            emailResult.error
          );
        }
      }
    }

    return {
      job: 'expiry-warnings',
      success: true,
      details: results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      job: 'expiry-warnings',
      success: false,
      details: results,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Job: Monthly Statements (placeholder)
// ============================================================================

/**
 * Send monthly statements to all active accounts
 * This should run on the 1st of each month
 */
async function runMonthlyStatementsJob(): Promise<JobResult> {
  // TODO: Implement monthly statement logic
  // This would:
  // 1. Get all accounts with activity in the last month
  // 2. Compile a summary of points earned/redeemed
  // 3. Send monthly statement email

  console.log('[LimohawkCron] Monthly statements job not yet implemented');

  return {
    job: 'monthly-statements',
    success: true,
    details: {
      message: 'Monthly statements not yet implemented',
    },
  };
}

// ============================================================================
// Vercel Config
// ============================================================================

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for cron jobs
};
