/**
 * Ask Me Anything Validation Schemas
 * Validation utilities for AMA API endpoints
 */

import {
  ValidationError,
  validateRequired,
  validateUuid,
  validateEnum,
} from '../../utils/validation-express';

// ==================== COMMON TYPES ====================

export type SessionStatus = 'draft' | 'scheduled' | 'live' | 'ended';
export type SessionVisibility = 'public' | 'group' | 'private';
export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected';
export type RSVPStatus = 'going' | 'maybe' | 'not_going';
export type VoteValue = 1 | -1;

// ==================== ENUMS ====================

export const SESSION_STATUSES = ['draft', 'scheduled', 'live', 'ended'] as const;
export const SESSION_VISIBILITIES = ['public', 'group', 'private'] as const;
export const MODERATION_STATUSES = ['pending', 'approved', 'flagged', 'rejected'] as const;
export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const;
export const VOTE_VALUES = [1, -1] as const;

// ==================== VALIDATION FUNCTIONS ====================

export const validateCreateSessionRequest = (body: any) => {
  const title = validateRequired(body.title, 'title');
  if (typeof title !== 'string') {
    throw new ValidationError('title must be a string', { field: 'title' });
  }
  if (title.trim().length < 5) {
    throw new ValidationError('title must be at least 5 characters', { field: 'title' });
  }
  if (title.length > 200) {
    throw new ValidationError('title must not exceed 200 characters', { field: 'title' });
  }

  const result: any = {
    title: title.trim(),
  };

  // Optional description
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      throw new ValidationError('description must be a string', { field: 'description' });
    }
    if (body.description.length > 2000) {
      throw new ValidationError('description must not exceed 2000 characters', {
        field: 'description',
      });
    }
    result.description = body.description.trim();
  }

  // Optional visibility
  if (body.visibility !== undefined) {
    validateEnum(body.visibility, SESSION_VISIBILITIES, 'visibility');
    result.visibility = body.visibility as SessionVisibility;
  }

  // Optional group ID (required if visibility is 'group')
  if (body.groupId !== undefined) {
    validateUuid(body.groupId, 'groupId');
    result.groupId = body.groupId;
  }

  // Validate group ID required for group visibility
  if (body.visibility === 'group' && !body.groupId) {
    throw new ValidationError('groupId is required when visibility is group', { field: 'groupId' });
  }

  // Optional scheduled date
  if (body.scheduledAt !== undefined) {
    if (typeof body.scheduledAt !== 'string') {
      throw new ValidationError('scheduledAt must be an ISO 8601 date string', {
        field: 'scheduledAt',
      });
    }
    result.scheduledAt = body.scheduledAt;
  }

  // Optional duration (default 60 minutes)
  if (body.durationMinutes !== undefined) {
    if (
      typeof body.durationMinutes !== 'number' ||
      body.durationMinutes < 15 ||
      body.durationMinutes > 480
    ) {
      throw new ValidationError('durationMinutes must be between 15 and 480', {
        field: 'durationMinutes',
      });
    }
    result.durationMinutes = body.durationMinutes;
  }

  // Optional template ID
  if (body.templateId !== undefined) {
    validateUuid(body.templateId, 'templateId');
    result.templateId = body.templateId;
  }

  // Optional category
  if (body.category !== undefined) {
    if (typeof body.category !== 'string') {
      throw new ValidationError('category must be a string', { field: 'category' });
    }
    result.category = body.category.trim();
  }

  // Optional event image
  if (body.eventImage !== undefined) {
    if (typeof body.eventImage !== 'string') {
      throw new ValidationError('eventImage must be a string URL', { field: 'eventImage' });
    }
    result.eventImage = body.eventImage;
  }

  // Guest fields
  if (body.guestName !== undefined) {
    if (typeof body.guestName !== 'string') {
      throw new ValidationError('guestName must be a string', { field: 'guestName' });
    }
    result.guestName = body.guestName.trim();
  }
  if (body.guestEmail !== undefined) {
    if (typeof body.guestEmail !== 'string') {
      throw new ValidationError('guestEmail must be a string', { field: 'guestEmail' });
    }
    result.guestEmail = body.guestEmail.trim();
  }
  if (body.guestProfileId !== undefined) {
    validateUuid(body.guestProfileId, 'guestProfileId');
    result.guestProfileId = body.guestProfileId;
  }
  if (body.guestBio !== undefined) {
    if (typeof body.guestBio !== 'string') {
      throw new ValidationError('guestBio must be a string', { field: 'guestBio' });
    }
    result.guestBio = body.guestBio.trim();
  }
  if (body.guestAvatar !== undefined) {
    if (typeof body.guestAvatar !== 'string') {
      throw new ValidationError('guestAvatar must be a string URL', { field: 'guestAvatar' });
    }
    result.guestAvatar = body.guestAvatar;
  }

  // Host fields
  if (body.hostName !== undefined) {
    if (typeof body.hostName !== 'string') {
      throw new ValidationError('hostName must be a string', { field: 'hostName' });
    }
    result.hostName = body.hostName.trim();
  }
  if (body.hostEmail !== undefined) {
    if (typeof body.hostEmail !== 'string') {
      throw new ValidationError('hostEmail must be a string', { field: 'hostEmail' });
    }
    result.hostEmail = body.hostEmail.trim();
  }
  if (body.hostProfileId !== undefined) {
    validateUuid(body.hostProfileId, 'hostProfileId');
    result.hostProfileId = body.hostProfileId;
  }
  if (body.hostBio !== undefined) {
    if (typeof body.hostBio !== 'string') {
      throw new ValidationError('hostBio must be a string', { field: 'hostBio' });
    }
    result.hostBio = body.hostBio.trim();
  }
  if (body.hostAvatar !== undefined) {
    if (typeof body.hostAvatar !== 'string') {
      throw new ValidationError('hostAvatar must be a string URL', { field: 'hostAvatar' });
    }
    result.hostAvatar = body.hostAvatar;
  }

  return result;
};

export const validateUpdateSessionRequest = (body: any) => {
  const updates: any = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      throw new ValidationError('title must be a string', { field: 'title' });
    }
    if (body.title.trim().length < 5) {
      throw new ValidationError('title must be at least 5 characters', { field: 'title' });
    }
    updates.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      throw new ValidationError('description must be a string', { field: 'description' });
    }
    updates.description = body.description.trim();
  }

  if (body.status !== undefined) {
    validateEnum(body.status, SESSION_STATUSES, 'status');
    updates.status = body.status;
  }

  if (body.scheduledAt !== undefined) {
    updates.scheduledAt = body.scheduledAt;
  }

  if (body.durationMinutes !== undefined) {
    if (
      typeof body.durationMinutes !== 'number' ||
      body.durationMinutes < 15 ||
      body.durationMinutes > 480
    ) {
      throw new ValidationError('durationMinutes must be between 15 and 480', {
        field: 'durationMinutes',
      });
    }
    updates.durationMinutes = body.durationMinutes;
  }

  if (body.settings !== undefined) {
    updates.settings = body.settings;
  }

  return updates;
};

export const validateSubmitQuestionRequest = (body: any) => {
  const amaSessionId = validateRequired(body.amaSessionId, 'amaSessionId');
  validateUuid(amaSessionId, 'amaSessionId');

  const questionText = validateRequired(body.questionText, 'questionText');
  if (typeof questionText !== 'string') {
    throw new ValidationError('questionText must be a string', { field: 'questionText' });
  }
  if (questionText.trim().length < 5) {
    throw new ValidationError('questionText must be at least 5 characters', {
      field: 'questionText',
    });
  }
  if (questionText.length > 1000) {
    throw new ValidationError('questionText must not exceed 1000 characters', {
      field: 'questionText',
    });
  }

  const isAnonymous = body.isAnonymous !== undefined ? Boolean(body.isAnonymous) : false;

  const result: any = {
    amaSessionId,
    questionText: questionText.trim(),
    isAnonymous,
  };

  if (body.profileId !== undefined) {
    validateUuid(body.profileId, 'profileId');
    result.profileId = body.profileId;
  }

  return result;
};

export const validateUpdateQuestionRequest = (body: any) => {
  const updates: any = {};

  if (body.isHighlighted !== undefined) {
    updates.isHighlighted = Boolean(body.isHighlighted);
  }

  if (body.isPinned !== undefined) {
    updates.isPinned = Boolean(body.isPinned);
  }

  if (body.isAnswered !== undefined) {
    updates.isAnswered = Boolean(body.isAnswered);
  }

  if (body.moderationStatus !== undefined) {
    validateEnum(body.moderationStatus, MODERATION_STATUSES, 'moderationStatus');
    updates.moderationStatus = body.moderationStatus;
  }

  if (body.answerText !== undefined) {
    if (typeof body.answerText !== 'string') {
      throw new ValidationError('answerText must be a string', { field: 'answerText' });
    }
    updates.answerText = body.answerText.trim();
    updates.answeredAt = new Date().toISOString();
    updates.isAnswered = true;
  }

  return updates;
};

export const validateVoteRequest = (body: any) => {
  const questionId = validateRequired(body.questionId, 'questionId');
  validateUuid(questionId, 'questionId');

  const voteValue = validateRequired(body.voteValue, 'voteValue');
  if (voteValue !== 1 && voteValue !== -1) {
    throw new ValidationError('voteValue must be 1 or -1', {
      field: 'voteValue',
      value: voteValue,
    });
  }

  return {
    questionId,
    voteValue: voteValue as VoteValue,
  };
};

export const validateRSVPRequest = (body: any) => {
  const sessionId = validateRequired(body.sessionId, 'sessionId');
  validateUuid(sessionId, 'sessionId');

  const rsvpStatus = validateRequired(body.rsvpStatus, 'rsvpStatus');
  validateEnum(rsvpStatus, RSVP_STATUSES, 'rsvpStatus');

  return {
    sessionId,
    rsvpStatus: rsvpStatus as RSVPStatus,
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

export const validateSessionFilter = (query: any) => {
  const filter: any = {};

  if (query.status) {
    validateEnum(query.status, SESSION_STATUSES, 'status');
    filter.status = query.status;
  }

  if (query.visibility) {
    validateEnum(query.visibility, SESSION_VISIBILITIES, 'visibility');
    filter.visibility = query.visibility;
  }

  return filter;
};

export const validateQuestionFilter = (query: any) => {
  const filter: any = {};

  if (query.filter) {
    const validFilters = ['all', 'highlighted', 'answered', 'unanswered'];
    if (!validFilters.includes(query.filter)) {
      throw new ValidationError('filter must be one of: all, highlighted, answered, unanswered', {
        field: 'filter',
        value: query.filter,
      });
    }
    filter.filter = query.filter;
  }

  return filter;
};
