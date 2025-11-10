/**
 * Hugo Love Main Router
 * Consolidates all Hugo Love API endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import swipeRouter from './swipe';
import ratingsRouter from './ratings';
import matchesRouter from './matches';
import profilesRouter from './profiles';
import messagesRouter from './messages';
import aiChatRouter from './ai-chat';
import journalRouter from './journal';
import subscriptionsRouter from './subscriptions';
import moderationRouter from './moderation';

const router = Router();

// All Hugo Love routes require authentication
router.use(requireAuth);

// Mount routers
router.use('/swipe', swipeRouter);
router.use('/swipes', swipeRouter); // For GET /swipes and /swipes/today
router.use('/ratings', ratingsRouter);
router.use('/matches', matchesRouter);
router.use('/profiles', profilesRouter);
router.use('/matches', messagesRouter); // For /matches/:matchId/messages
router.use('/messages', messagesRouter); // For /messages/:messageId operations
router.use('/ai-chat', aiChatRouter);
router.use('/journal', journalRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/reports', moderationRouter);

export default router;
