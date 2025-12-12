/**
 * Hugo Love Subscriptions Routes
 * GET /api/v1/hugo-love/subscriptions/me - Get subscription status
 * POST /api/v1/hugo-love/subscriptions - Create subscription
 * POST /api/v1/hugo-love/subscriptions/cancel - Cancel subscription
 * GET /api/v1/hugo-love/subscriptions/plans - Get available plans
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateCreateSubscriptionRequest } from './validation';
import { ValidationError } from '../../utils/validation-express';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/hugo-love/subscriptions/me
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - subscriptions are per profile
    const userId = req.profileId || req.user!.id;
    const supabase = getSupabase(req);

    const { data: subscription, error } = await supabase
      .from('hugo_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Subscription fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch subscription', code: 'SERVER_ERROR' });
      return;
    }

    // Default to free tier if no subscription
    if (!subscription) {
      res.json({
        tier: 'free',
        status: 'active',
        autoRenew: false,
        features: {
          unlimitedSwipes: false,
          unlimitedLikes: false,
          aiCoaching: false,
          advancedFilters: false,
          priorityMatching: false,
        },
      });
      return;
    }

    res.json({
      subscriptionId: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
      startDate: subscription.start_date,
      expiresAt: subscription.expires_at,
      autoRenew: subscription.auto_renew,
      features: subscription.features,
    });
  } catch (error: any) {
    console.error('Subscription status endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/v1/hugo-love/subscriptions
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - subscriptions are per profile
    const userId = req.profileId || req.user!.id;
    const validated = validateCreateSubscriptionRequest(req.body);

    const supabase = getSupabase(req);

    // Calculate expiration date based on billing cycle
    const expiresAt = new Date();
    if (validated.billingCycle === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Mock payment amount (replace with actual Stripe integration)
    const paymentAmount =
      validated.tier === 'premium'
        ? validated.billingCycle === 'monthly'
          ? 9.99
          : 99.99
        : validated.billingCycle === 'monthly'
          ? 19.99
          : 199.99;

    const features = {
      unlimitedSwipes: true,
      unlimitedLikes: true,
      aiCoaching: validated.tier === 'vip',
      advancedFilters: true,
      priorityMatching: validated.tier === 'vip',
    };

    const { data: subscription, error } = await supabase
      .from('hugo_subscriptions')
      .insert({
        user_id: userId,
        tier: validated.tier,
        status: 'active',
        billing_cycle: validated.billingCycle,
        payment_method_id: validated.paymentMethodId,
        expires_at: expiresAt.toISOString(),
        features,
      })
      .select()
      .single();

    if (error) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ error: 'Failed to create subscription', code: 'SERVER_ERROR' });
      return;
    }

    res.status(201).json({
      subscriptionId: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
      expiresAt: subscription.expires_at,
      paymentAmount,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Subscription creation endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * POST /api/v1/hugo-love/subscriptions/cancel
 */
router.post('/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - subscriptions are per profile
    const userId = req.profileId || req.user!.id;
    const supabase = getSupabase(req);

    const { data: subscription } = await supabase
      .from('hugo_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      res.status(404).json({ error: 'No active subscription found', code: 'NOT_FOUND' });
      return;
    }

    const { data: updated, error } = await supabase
      .from('hugo_subscriptions')
      .update({ status: 'canceled', auto_renew: false })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) {
      console.error('Subscription cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel subscription', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      subscriptionId: updated.id,
      status: 'canceled',
      expiresAt: updated.expires_at,
    });
  } catch (error: any) {
    console.error('Subscription cancel endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/v1/hugo-love/subscriptions/plans
 */
router.get('/plans', async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = [
      {
        tier: 'free',
        name: 'Free',
        description: 'Basic dating features',
        price: { monthly: 0, annual: 0 },
        features: ['Limited swipes per day', 'Basic profile', 'Standard matching'],
      },
      {
        tier: 'premium',
        name: 'Premium',
        description: 'Enhanced dating experience',
        price: { monthly: 9.99, annual: 99.99 },
        features: [
          'Unlimited swipes',
          'Unlimited likes',
          'Advanced filters',
          'See who liked you',
          'Priority support',
        ],
      },
      {
        tier: 'vip',
        name: 'VIP',
        description: 'Complete dating toolkit',
        price: { monthly: 19.99, annual: 199.99 },
        features: [
          'All Premium features',
          'AI coaching',
          'Priority matching',
          'Verified badge',
          'Exclusive events access',
        ],
      },
    ];

    res.json({ plans });
  } catch (error: any) {
    console.error('Plans endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
