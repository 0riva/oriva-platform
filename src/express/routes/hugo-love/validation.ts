/**
 * Hugo Love Validation Schemas
 * Validation utilities for Hugo Love API endpoints
 */

import {
  ValidationError,
  validateRequired,
  validateUuid,
  validateEnum,
} from '../../utils/validation-express';

// ==================== COMMON TYPES ====================

export type SwipeDecision = 'like' | 'pass';
export type MatchStatus = 'active' | 'archived' | 'blocked';
export type SubscriptionTier = 'free' | 'premium' | 'vip';
export type SubscriptionStatus = 'active' | 'expired' | 'canceled';
export type ReportReason =
  | 'inappropriate_content'
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
export type AICoachingContext = 'dating' | 'profile' | 'conversation';
export type BillingCycle = 'monthly' | 'annual';

// ==================== ENUMS ====================

export const SWIPE_DECISIONS = ['like', 'pass'] as const;
export const MATCH_STATUSES = ['active', 'archived', 'blocked'] as const;
export const SUBSCRIPTION_TIERS = ['free', 'premium', 'vip'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'expired', 'canceled'] as const;
export const REPORT_REASONS = [
  'inappropriate_content',
  'harassment',
  'spam',
  'fake_profile',
  'other',
] as const;
export const REPORT_STATUSES = ['pending', 'reviewed', 'action_taken', 'dismissed'] as const;
export const AI_COACHING_CONTEXTS = ['dating', 'profile', 'conversation'] as const;
export const BILLING_CYCLES = ['monthly', 'annual'] as const;

// ==================== VALIDATION FUNCTIONS ====================

export const validateSwipeRequest = (body: any) => {
  const targetUserId = validateRequired(body.targetUserId, 'targetUserId');
  validateUuid(targetUserId, 'targetUserId');

  const decision = validateRequired(body.decision, 'decision');
  validateEnum(decision, SWIPE_DECISIONS, 'decision');

  return {
    targetUserId,
    decision: decision as SwipeDecision,
  };
};

export const validateRatingRequest = (body: any) => {
  const targetUserId = validateRequired(body.targetUserId, 'targetUserId');
  validateUuid(targetUserId, 'targetUserId');

  const score = validateRequired(body.score, 'score');
  if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
    throw new ValidationError('score must be an integer between 1 and 5', {
      field: 'score',
      value: score,
    });
  }

  const comment = body.comment;
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      throw new ValidationError('comment must be a string', { field: 'comment' });
    }
    if (comment.length > 500) {
      throw new ValidationError('comment must not exceed 500 characters', { field: 'comment' });
    }
  }

  return {
    targetUserId,
    score: score as 1 | 2 | 3 | 4 | 5,
    comment: comment ? comment.trim() : undefined,
  };
};

export const validateUpdateMatchRequest = (body: any) => {
  const status = validateRequired(body.status, 'status');
  validateEnum(status, MATCH_STATUSES, 'status');

  return {
    status: status as MatchStatus,
  };
};

export const validateUpdateProfileRequest = (body: any) => {
  const updates: any = {};

  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      throw new ValidationError('bio must be a string', { field: 'bio' });
    }
    if (body.bio.length > 500) {
      throw new ValidationError('bio must not exceed 500 characters', { field: 'bio' });
    }
    updates.bio = body.bio.trim();
  }

  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) {
      throw new ValidationError('photos must be an array', { field: 'photos' });
    }
    if (body.photos.length > 6) {
      throw new ValidationError('photos array must not exceed 6 items', { field: 'photos' });
    }
    updates.photos = body.photos;
  }

  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests)) {
      throw new ValidationError('interests must be an array', { field: 'interests' });
    }
    if (body.interests.length > 10) {
      throw new ValidationError('interests array must not exceed 10 items', { field: 'interests' });
    }
    updates.interests = body.interests;
  }

  if (body.age !== undefined) {
    if (typeof body.age !== 'number' || body.age < 18) {
      throw new ValidationError('age must be a number >= 18', { field: 'age' });
    }
    updates.age = body.age;
  }

  if (body.location !== undefined) {
    if (
      typeof body.location !== 'object' ||
      !body.location.city ||
      !body.location.state ||
      !body.location.country
    ) {
      throw new ValidationError('location must contain city, state, and country', {
        field: 'location',
      });
    }
    updates.location = body.location;
  }

  if (body.preferences !== undefined) {
    updates.preferences = body.preferences;
  }

  return updates;
};

export const validateBlockUserRequest = (body: any) => {
  const blockedUserId = validateRequired(body.blockedUserId, 'blockedUserId');
  validateUuid(blockedUserId, 'blockedUserId');

  return { blockedUserId };
};

export const validateSendMessageRequest = (body: any) => {
  const text = validateRequired(body.text, 'text');
  if (typeof text !== 'string') {
    throw new ValidationError('text must be a string', { field: 'text' });
  }
  if (text.length > 1000) {
    throw new ValidationError('text must not exceed 1000 characters', { field: 'text' });
  }

  const attachments = body.attachments;
  if (attachments !== undefined) {
    if (!Array.isArray(attachments)) {
      throw new ValidationError('attachments must be an array', { field: 'attachments' });
    }
    if (attachments.length > 3) {
      throw new ValidationError('attachments must not exceed 3 items', { field: 'attachments' });
    }
  }

  return {
    text: text.trim(),
    attachments: attachments || undefined,
  };
};

export const validateAIChatRequest = (body: any) => {
  const prompt = validateRequired(body.prompt, 'prompt');
  if (typeof prompt !== 'string') {
    throw new ValidationError('prompt must be a string', { field: 'prompt' });
  }

  const context = validateRequired(body.context, 'context');
  validateEnum(context, AI_COACHING_CONTEXTS, 'context');

  return {
    prompt: prompt.trim(),
    context: context as AICoachingContext,
  };
};

export const validateChatFeedbackRequest = (body: any) => {
  const sessionId = validateRequired(body.sessionId, 'sessionId');
  validateUuid(sessionId, 'sessionId');

  const rating = validateRequired(body.rating, 'rating');
  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new ValidationError('rating must be an integer between 1 and 5', {
      field: 'rating',
      value: rating,
    });
  }

  const comment = body.comment;
  if (comment !== undefined && typeof comment !== 'string') {
    throw new ValidationError('comment must be a string', { field: 'comment' });
  }

  return {
    sessionId,
    rating: rating as 1 | 2 | 3 | 4 | 5,
    comment: comment ? comment.trim() : undefined,
  };
};

export const validateCreateJournalRequest = (body: any) => {
  const text = validateRequired(body.text, 'text');
  if (typeof text !== 'string') {
    throw new ValidationError('text must be a string', { field: 'text' });
  }
  if (text.length > 5000) {
    throw new ValidationError('text must not exceed 5000 characters', { field: 'text' });
  }

  const date = validateRequired(body.date, 'date');
  if (typeof date !== 'string') {
    throw new ValidationError('date must be an ISO 8601 date string', { field: 'date' });
  }

  const tags = body.tags;
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      throw new ValidationError('tags must be an array', { field: 'tags' });
    }
    if (tags.length > 10) {
      throw new ValidationError('tags must not exceed 10 items', { field: 'tags' });
    }
  }

  return {
    text: text.trim(),
    date,
    tags: tags || undefined,
  };
};

export const validateUpdateJournalRequest = (body: any) => {
  const updates: any = {};

  if (body.text !== undefined) {
    if (typeof body.text !== 'string') {
      throw new ValidationError('text must be a string', { field: 'text' });
    }
    if (body.text.length > 5000) {
      throw new ValidationError('text must not exceed 5000 characters', { field: 'text' });
    }
    updates.text = body.text.trim();
  }

  if (body.date !== undefined) {
    if (typeof body.date !== 'string') {
      throw new ValidationError('date must be an ISO 8601 date string', { field: 'date' });
    }
    updates.date = body.date;
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      throw new ValidationError('tags must be an array', { field: 'tags' });
    }
    if (body.tags.length > 10) {
      throw new ValidationError('tags must not exceed 10 items', { field: 'tags' });
    }
    updates.tags = body.tags;
  }

  return updates;
};

export const validateCreateSubscriptionRequest = (body: any) => {
  const tier = validateRequired(body.tier, 'tier');
  validateEnum(tier, ['premium', 'vip'], 'tier');

  const paymentMethodId = validateRequired(body.paymentMethodId, 'paymentMethodId');
  if (typeof paymentMethodId !== 'string') {
    throw new ValidationError('paymentMethodId must be a string', { field: 'paymentMethodId' });
  }

  const billingCycle = validateRequired(body.billingCycle, 'billingCycle');
  validateEnum(billingCycle, BILLING_CYCLES, 'billingCycle');

  return {
    tier: tier as 'premium' | 'vip',
    paymentMethodId,
    billingCycle: billingCycle as BillingCycle,
  };
};

export const validateReportRequest = (body: any) => {
  const reportedUserId = validateRequired(body.reportedUserId, 'reportedUserId');
  validateUuid(reportedUserId, 'reportedUserId');

  const reason = validateRequired(body.reason, 'reason');
  validateEnum(reason, REPORT_REASONS, 'reason');

  const description = validateRequired(body.description, 'description');
  if (typeof description !== 'string') {
    throw new ValidationError('description must be a string', { field: 'description' });
  }
  if (description.length > 1000) {
    throw new ValidationError('description must not exceed 1000 characters', {
      field: 'description',
    });
  }

  const evidenceUrls = body.evidenceUrls;
  if (evidenceUrls !== undefined && !Array.isArray(evidenceUrls)) {
    throw new ValidationError('evidenceUrls must be an array', { field: 'evidenceUrls' });
  }

  return {
    reportedUserId,
    reason: reason as ReportReason,
    description: description.trim(),
    evidenceUrls: evidenceUrls || undefined,
  };
};

export const validatePagination = (query: any): { limit: number; offset: number } => {
  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('limit must be between 1 and 100', {
      field: 'limit',
      value: query.limit,
    });
  }

  if (isNaN(offset) || offset < 0) {
    throw new ValidationError('offset must be a non-negative integer', {
      field: 'offset',
      value: query.offset,
    });
  }

  return { limit, offset };
};
