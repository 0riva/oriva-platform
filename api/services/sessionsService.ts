/**
 * Sessions Service
 * Task: T028
 *
 * Business logic for AI coaching sessions in hugo_ai schema.
 * Handles session creation, updates, and retrieval across all apps.
 */

import { Request } from 'express';
import {
  createQueryBuilder,
  executeQuery,
  calculateDuration,
  DatabaseError,
} from '../utils/database';
import {
  validateRequired,
  validateUuid,
  validateSessionType,
  validateQualityScore,
  SessionType,
} from '../utils/validation';

/**
 * Create session request
 */
export interface CreateSessionRequest {
  session_type: string;
  context_data?: Record<string, unknown>;
}

/**
 * Update session request
 */
export interface UpdateSessionRequest {
  ended_at?: string;
  duration_seconds?: number;
  insights_generated?: Array<{
    insight_type: string;
    content: string;
    confidence: number;
    supporting_data?: Record<string, unknown>;
  }>;
  quality_score?: number;
}

/**
 * Session response
 */
export interface SessionResponse {
  id: string;
  user_id: string;
  app_id: string;
  session_type: SessionType;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  message_count: number;
  context_data?: Record<string, unknown>;
  insights_generated?: unknown[];
  quality_score?: number;
  created_at: string;
}

/**
 * Create a new coaching session
 */
export const createSession = async (
  req: Request,
  userId: string,
  input: CreateSessionRequest
): Promise<SessionResponse> => {
  validateUuid(userId, 'user_id');
  const sessionType = validateSessionType(input.session_type);

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Create session in hugo_ai schema
  const session = await executeQuery<SessionResponse>(
    () =>
      db
        .from('sessions')
        .insert({
          user_id: userId,
          app_id: appUuid,
          session_type: sessionType,
          started_at: new Date().toISOString(),
          message_count: 0,
          context_data: input.context_data || {},
          insights_generated: [],
        })
        .select()
        .single(),
    'create session'
  );

  return session;
};

/**
 * Update an existing session
 */
export const updateSession = async (
  req: Request,
  sessionId: string,
  userId: string,
  updates: UpdateSessionRequest
): Promise<SessionResponse> => {
  validateUuid(sessionId, 'session_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify session exists and belongs to user
  const existingSession = await executeQuery<SessionResponse>(
    () => db.from('sessions').select('*').eq('id', sessionId).eq('user_id', userId).single(),
    'verify session ownership'
  );

  // Build update object
  const updateData: Partial<UpdateSessionRequest> = {};

  if (updates.ended_at !== undefined) {
    updateData.ended_at = updates.ended_at;

    // Calculate duration if not provided
    if (updates.duration_seconds === undefined) {
      const duration = calculateDuration(existingSession.started_at, updates.ended_at);
      if (duration !== null) {
        updateData.duration_seconds = duration;
      }
    } else {
      updateData.duration_seconds = updates.duration_seconds;
    }
  }

  if (updates.insights_generated !== undefined) {
    updateData.insights_generated = updates.insights_generated;
  }

  if (updates.quality_score !== undefined) {
    validateQualityScore(updates.quality_score);
    updateData.quality_score = updates.quality_score;
  }

  // Update session
  const updatedSession = await executeQuery<SessionResponse>(
    () => db.from('sessions').update(updateData).eq('id', sessionId).select().single(),
    'update session'
  );

  return updatedSession;
};

/**
 * Get session by ID
 */
export const getSession = async (
  req: Request,
  sessionId: string,
  userId: string
): Promise<SessionResponse> => {
  validateUuid(sessionId, 'session_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const session = await executeQuery<SessionResponse>(
    () => db.from('sessions').select('*').eq('id', sessionId).eq('user_id', userId).single(),
    'get session'
  );

  return session;
};

/**
 * List user's sessions
 */
export const listUserSessions = async (
  req: Request,
  userId: string,
  filters?: {
    session_type?: string;
    app_id?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ sessions: SessionResponse[] }> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Build query
  let query = db
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  // Apply filters
  if (filters?.session_type) {
    const sessionType = validateSessionType(filters.session_type);
    query = query.eq('session_type', sessionType);
  }

  if (filters?.app_id) {
    validateUuid(filters.app_id, 'app_id');
    query = query.eq('app_id', filters.app_id);
  }

  // Apply pagination
  if (filters?.limit !== undefined && filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1);
  }

  const sessions = await executeQuery<SessionResponse[]>(
    () => query,
    'list sessions'
  );

  return { sessions };
};

/**
 * Delete session
 */
export const deleteSession = async (
  req: Request,
  sessionId: string,
  userId: string
): Promise<void> => {
  validateUuid(sessionId, 'session_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  await executeQuery(
    () => db.from('sessions').delete().eq('id', sessionId).eq('user_id', userId),
    'delete session'
  );
};

/**
 * Increment message count for a session
 */
export const incrementMessageCount = async (
  req: Request,
  sessionId: string,
  userId: string
): Promise<void> => {
  validateUuid(sessionId, 'session_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Get current message count
  const session = await getSession(req, sessionId, userId);

  // Increment
  await executeQuery(
    () =>
      db
        .from('sessions')
        .update({ message_count: session.message_count + 1 })
        .eq('id', sessionId),
    'increment message count'
  );
};

/**
 * Get session statistics for user
 */
export const getUserSessionStats = async (
  req: Request,
  userId: string
): Promise<{
  total_sessions: number;
  total_duration_seconds: number;
  total_messages: number;
  avg_quality_score: number | null;
  sessions_by_type: Record<SessionType, number>;
}> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const sessions = await executeQuery<SessionResponse[]>(
    () => db.from('sessions').select('*').eq('user_id', userId),
    'get user sessions for stats'
  );

  // Calculate statistics
  const stats = {
    total_sessions: sessions.length,
    total_duration_seconds: sessions.reduce(
      (sum, s) => sum + (s.duration_seconds || 0),
      0
    ),
    total_messages: sessions.reduce((sum, s) => sum + s.message_count, 0),
    avg_quality_score:
      sessions.filter((s) => s.quality_score !== null && s.quality_score !== undefined).length > 0
        ? sessions.reduce((sum, s) => sum + (s.quality_score || 0), 0) / sessions.length
        : null,
    sessions_by_type: {} as Record<SessionType, number>,
  };

  // Count by type
  sessions.forEach((session) => {
    stats.sessions_by_type[session.session_type] =
      (stats.sessions_by_type[session.session_type] || 0) + 1;
  });

  return stats;
};
