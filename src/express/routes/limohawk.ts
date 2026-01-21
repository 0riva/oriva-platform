/**
 * Limohawk Loyalty System Routes
 *
 * Admin API for managing loyalty accounts, points, and VIP memberships.
 *
 * Routes:
 *   GET    /accounts                    - List all accounts (paginated)
 *   GET    /accounts/:id                - Get account details
 *   GET    /accounts/:id/transactions   - Get transaction history
 *   POST   /accounts/:id/convert        - Convert points to credit
 *   POST   /accounts/:id/redeem         - Apply credit to booking
 *   POST   /admin/adjust                - Manual points adjustment
 *   POST   /admin/expire                - Trigger expiry job
 *   GET    /vip/status/:customerId      - Check VIP status by customer ID
 *   POST   /vip/checkout                - Create Stripe checkout session
 *   POST   /vip/cancel                  - Cancel VIP subscription
 *   GET    /vip/portal                  - Get Stripe customer portal URL
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuth } from '../middleware/auth';
import { loyaltyService } from '../../services/limohawk/loyaltyService';
import { vipService } from '../../services/limohawk/vipService';

const router = Router();

// ============================================================================
// Validation Helpers
// ============================================================================

const isValidUuid = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// ============================================================================
// Account Routes
// ============================================================================

/**
 * GET /accounts
 * List all loyalty accounts (paginated)
 */
router.get(
  '/accounts',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string | undefined;

    const result = await loyaltyService.listAccounts({ limit, offset, search });

    res.json({
      accounts: result.accounts,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + result.accounts.length < result.total,
      },
    });
  })
);

/**
 * GET /accounts/:id
 * Get account details with summary
 */
router.get(
  '/accounts/:id',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Account ID must be a valid UUID',
      });
      return;
    }

    const account = await loyaltyService.getAccount(id);

    if (!account) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
      return;
    }

    const summary = await loyaltyService.getAccountSummary(id);

    res.json({
      account,
      summary,
    });
  })
);

/**
 * GET /accounts/:id/transactions
 * Get transaction history for an account
 */
router.get(
  '/accounts/:id/transactions',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    if (!isValidUuid(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Account ID must be a valid UUID',
      });
      return;
    }

    // Verify account exists
    const account = await loyaltyService.getAccount(id);
    if (!account) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
      return;
    }

    const result = await loyaltyService.getTransactionHistory(id, { limit, offset, type });

    res.json({
      transactions: result.transactions,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + result.transactions.length < result.total,
      },
    });
  })
);

/**
 * POST /accounts/:id/convert
 * Convert points to credit
 */
router.post(
  '/accounts/:id/convert',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { points } = req.body;

    if (!isValidUuid(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Account ID must be a valid UUID',
      });
      return;
    }

    if (typeof points !== 'number' || points < 100) {
      res.status(400).json({
        code: 'INVALID_POINTS',
        message: 'Points must be a number >= 100',
      });
      return;
    }

    const result = await loyaltyService.convertPointsToCredit(id, points);

    if (!result.success) {
      res.status(400).json({
        code: 'CONVERSION_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      creditPence: result.creditPence,
      newPointsBalance: result.newPointsBalance,
      newCreditBalance: result.newCreditBalance,
    });
  })
);

/**
 * POST /accounts/:id/redeem
 * Apply credit to a booking
 */
router.post(
  '/accounts/:id/redeem',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { bookingId, bookingValuePence, creditRequestedPence } = req.body;

    if (!isValidUuid(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Account ID must be a valid UUID',
      });
      return;
    }

    if (!bookingId || typeof bookingId !== 'string') {
      res.status(400).json({
        code: 'INVALID_BOOKING_ID',
        message: 'bookingId is required',
      });
      return;
    }

    if (typeof bookingValuePence !== 'number' || bookingValuePence <= 0) {
      res.status(400).json({
        code: 'INVALID_BOOKING_VALUE',
        message: 'bookingValuePence must be a positive number',
      });
      return;
    }

    if (typeof creditRequestedPence !== 'number' || creditRequestedPence <= 0) {
      res.status(400).json({
        code: 'INVALID_CREDIT_AMOUNT',
        message: 'creditRequestedPence must be a positive number',
      });
      return;
    }

    const result = await loyaltyService.redeemCredit(id, {
      bookingId,
      bookingValuePence,
      creditRequestedPence,
    });

    if (!result.success) {
      res.status(400).json({
        code: 'REDEMPTION_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      redemptionId: result.redemptionId,
      creditAppliedPence: result.creditAppliedPence,
      newCreditBalance: result.newCreditBalance,
    });
  })
);

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * POST /admin/adjust
 * Manual points adjustment (admin only)
 */
router.post(
  '/admin/adjust',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId, pointsAmount, reason, performedBy } = req.body;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    if (typeof pointsAmount !== 'number' || pointsAmount === 0) {
      res.status(400).json({
        code: 'INVALID_POINTS',
        message: 'pointsAmount must be a non-zero number',
      });
      return;
    }

    if (!reason || typeof reason !== 'string') {
      res.status(400).json({
        code: 'MISSING_REASON',
        message: 'reason is required',
      });
      return;
    }

    if (!performedBy || typeof performedBy !== 'string') {
      res.status(400).json({
        code: 'MISSING_PERFORMED_BY',
        message: 'performedBy is required (staff ID or email)',
      });
      return;
    }

    const result = await loyaltyService.adminAdjustPoints({
      accountId,
      pointsAmount,
      reason,
      performedBy,
    });

    if (!result.success) {
      res.status(400).json({
        code: 'ADJUSTMENT_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    });
  })
);

/**
 * POST /admin/expire
 * Trigger points expiry job manually
 */
router.post(
  '/admin/expire',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await loyaltyService.triggerExpiry();

    res.json({
      success: true,
      accountsExpired: result.accountsExpired,
      pointsExpired: result.pointsExpired,
    });
  })
);

/**
 * GET /admin/expiring
 * Get accounts with points expiring soon
 */
router.get(
  '/admin/expiring',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const daysUntilExpiry = parseInt(req.query.days as string) || 30;

    const accounts = await loyaltyService.getAccountsExpiringSoon(daysUntilExpiry);

    res.json({
      accounts,
      daysUntilExpiry,
    });
  })
);

// ============================================================================
// VIP Routes
// ============================================================================

/**
 * GET /vip/status/:customerId
 * Check VIP status by external customer ID
 */
router.get(
  '/vip/status/:customerId',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;

    if (!customerId || customerId.length === 0) {
      res.status(400).json({
        code: 'INVALID_CUSTOMER_ID',
        message: 'customerId is required',
      });
      return;
    }

    const status = await vipService.getVipStatusByCustomerId(customerId);

    res.json(status);
  })
);

/**
 * GET /vip/status/account/:accountId
 * Check VIP status by account ID
 */
router.get(
  '/vip/status/account/:accountId',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId } = req.params;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    const status = await vipService.getVipStatus(accountId);

    res.json(status);
  })
);

/**
 * POST /vip/checkout
 * Create Stripe checkout session for VIP subscription
 */
router.post(
  '/vip/checkout',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId, externalCustomerId, email, plan, successUrl, cancelUrl } = req.body;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    if (!externalCustomerId || typeof externalCustomerId !== 'string') {
      res.status(400).json({
        code: 'INVALID_CUSTOMER_ID',
        message: 'externalCustomerId is required',
      });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Valid email is required',
      });
      return;
    }

    if (!['monthly', 'annual'].includes(plan)) {
      res.status(400).json({
        code: 'INVALID_PLAN',
        message: 'plan must be "monthly" or "annual"',
      });
      return;
    }

    if (!successUrl || !cancelUrl) {
      res.status(400).json({
        code: 'MISSING_URLS',
        message: 'successUrl and cancelUrl are required',
      });
      return;
    }

    const result = await vipService.startVipSubscription({
      accountId,
      externalCustomerId,
      email,
      plan,
      successUrl,
      cancelUrl,
    });

    if (!result.success) {
      res.status(400).json({
        code: 'CHECKOUT_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
    });
  })
);

/**
 * POST /vip/cancel
 * Cancel VIP subscription
 */
router.post(
  '/vip/cancel',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId, cancelAtPeriodEnd = true } = req.body;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    const result = await vipService.cancelVipSubscription(accountId, cancelAtPeriodEnd);

    if (!result.success) {
      res.status(400).json({
        code: 'CANCELLATION_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: cancelAtPeriodEnd
        ? 'Subscription will be cancelled at the end of the current billing period'
        : 'Subscription has been cancelled immediately',
    });
  })
);

/**
 * GET /vip/portal
 * Get Stripe customer portal URL
 */
router.get(
  '/vip/portal',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const accountId = req.query.accountId as string;
    const returnUrl = req.query.returnUrl as string;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    if (!returnUrl) {
      res.status(400).json({
        code: 'MISSING_RETURN_URL',
        message: 'returnUrl is required',
      });
      return;
    }

    const result = await vipService.getCustomerPortalUrl(accountId, returnUrl);

    if (!result.success) {
      res.status(400).json({
        code: 'PORTAL_FAILED',
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      portalUrl: result.portalUrl,
    });
  })
);

/**
 * GET /vip/membership/:accountId
 * Get membership details for an account
 */
router.get(
  '/vip/membership/:accountId',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId } = req.params;

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    const membership = await vipService.getMembership(accountId);

    if (!membership) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'No VIP membership found for this account',
      });
      return;
    }

    res.json(membership);
  })
);

/**
 * GET /vip/membership/:accountId/history
 * Get membership history for an account
 */
router.get(
  '/vip/membership/:accountId/history',
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { accountId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!isValidUuid(accountId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'accountId must be a valid UUID',
      });
      return;
    }

    const history = await vipService.getMembershipHistory(accountId, limit);

    res.json({
      history,
    });
  })
);

export default router;
