/**
 * Travel Hub Concierge Main Router
 * Consolidates all Travel Hub Concierge API endpoints
 */

import { Router } from 'express';
import { requireJwtAuth } from '../../middleware/auth';
import conciergesRouter from './concierges';
import clientsRouter from './clients';
import itinerariesRouter from './itineraries';
import chatRouter from './chat';
import adminRouter from './admin';

const router = Router();

// All Travel Hub Concierge routes require JWT authentication
// Using requireJwtAuth which validates JWT without requiring public.users table
// Travel Hub uses travel_hub.system_users and travel_hub.concierges for user management
router.use(requireJwtAuth);

// Mount routers
router.use('/concierges', conciergesRouter);
router.use('/clients', clientsRouter);
router.use('/itineraries', itinerariesRouter);
router.use('/chat', chatRouter);
router.use('/admin', adminRouter);

export default router;
