/**
 * Insights Service
 * Task: T029
 *
 * Business logic for AI-generated insights in hugo_ai schema.
 * Handles insight creation with cross-app visibility and retrieval.
 */

import { Request } from 'express';
import { createQueryBuilder, executeQuery, DatabaseError } from '../utils/database';
import {
  validateRequired,
  validateUuid,
  validateInsightType,
  validateConfidence,
  calculateCrossAppVisibility,
  InsightType,
} from '../utils/validation';

/**
 * Create insight request
 */
export interface CreateInsightRequest {
  user_id?: string;
  session_id?: string;
  insight_type: string;
  content: string;
  confidence: number;
  supporting_data?: Record<string, unknown>;
}

/**
 * Insight response
 */
export interface InsightResponse {
  id: string;
  session_id: string | null;
  user_id: string;
  source_app_id: string;
  insight_type: InsightType;
  content: string;
  confidence: number;
  cross_app_visibility: boolean;
  supporting_data?: Record<string, unknown>;
  created_at: string;
}

/**
 * Create a new insight
 */
export const createInsight = async (
  req: Request,
  userId: string,
  input: CreateInsightRequest
): Promise<InsightResponse> => {
  validateUuid(userId, 'user_id');
  validateRequired(input.content, 'content');

  // Validate session_id if provided
  if (input.session_id) {
    validateUuid(input.session_id, 'session_id');
  }

  const insightType = validateInsightType(input.insight_type);
  const confidence = validateConfidence(input.confidence);
  const crossAppVisibility = calculateCrossAppVisibility(confidence);

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Note: session_id foreign key constraint in DB will ensure session exists

  // Create insight in hugo_ai schema
  const insight = await executeQuery<InsightResponse>(
    () =>
      db
        .from('insights')
        .insert({
          session_id: input.session_id || null,
          user_id: userId,
          source_app_id: appUuid,
          insight_type: insightType,
          content: input.content,
          confidence,
          cross_app_visibility: crossAppVisibility,
          supporting_data: input.supporting_data || {},
        })
        .select()
        .single(),
    'create insight'
  );

  return insight;
};

/**
 * Get insight by ID
 */
export const getInsight = async (
  req: Request,
  insightId: string,
  userId: string
): Promise<InsightResponse> => {
  validateUuid(insightId, 'insight_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Get insight with cross-app visibility check
  const insight = await executeQuery<InsightResponse>(
    () =>
      db
        .from('insights')
        .select('*')
        .eq('id', insightId)
        .eq('user_id', userId)
        .or(`source_app_id.eq.${appUuid},cross_app_visibility.eq.true`)
        .single(),
    'get insight'
  );

  return insight;
};

/**
 * List user's insights
 */
export const listUserInsights = async (
  req: Request,
  userId: string,
  filters?: {
    insight_type?: string;
    min_confidence?: number;
    source_app_id?: string;
    cross_app_only?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ insights: InsightResponse[] }> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Build query with cross-app visibility
  let query = db
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .or(`source_app_id.eq.${appUuid},cross_app_visibility.eq.true`)
    .order('created_at', { ascending: false });

  // Apply insight_type filter
  if (filters?.insight_type) {
    const insightType = validateInsightType(filters.insight_type);
    query = query.eq('insight_type', insightType);
  }

  // Apply confidence filter
  if (filters?.min_confidence !== undefined) {
    const minConfidence = validateConfidence(filters.min_confidence);
    query = query.gte('confidence', minConfidence);
  }

  // Apply source_app_id filter
  if (filters?.source_app_id) {
    validateUuid(filters.source_app_id, 'source_app_id');
    query = query.eq('source_app_id', filters.source_app_id);
  }

  // Apply cross_app_only filter
  if (filters?.cross_app_only) {
    query = query.eq('cross_app_visibility', true);
  }

  // Apply pagination
  if (filters?.limit !== undefined && filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1);
  }

  const insights = await executeQuery<InsightResponse[]>(() => query, 'list insights');

  return { insights };
};

/**
 * List insights for a session
 */
export const listSessionInsights = async (
  req: Request,
  sessionId: string,
  userId: string
): Promise<{ insights: InsightResponse[] }> => {
  validateUuid(sessionId, 'session_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify session exists and belongs to user
  await executeQuery<{ id: string }>(
    () => db.from('sessions').select('id').eq('id', sessionId).eq('user_id', userId).single(),
    'verify session ownership'
  );

  // Get all insights for session
  const insights = await executeQuery<InsightResponse[]>(
    () =>
      db
        .from('insights')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
    'list session insights'
  );

  return { insights };
};

/**
 * Update insight metadata
 */
export const updateInsightMetadata = async (
  req: Request,
  insightId: string,
  userId: string,
  metadata: Record<string, unknown>
): Promise<InsightResponse> => {
  validateUuid(insightId, 'insight_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Verify insight exists and belongs to user (and is from current app)
  await executeQuery<{ id: string }>(
    () =>
      db
        .from('insights')
        .select('id')
        .eq('id', insightId)
        .eq('user_id', userId)
        .eq('source_app_id', appUuid)
        .single(),
    'verify insight ownership'
  );

  // Update metadata
  const updatedInsight = await executeQuery<InsightResponse>(
    () => db.from('insights').update({ metadata }).eq('id', insightId).select().single(),
    'update insight metadata'
  );

  return updatedInsight;
};

/**
 * Get insight statistics for user
 */
export const getUserInsightStats = async (
  req: Request,
  userId: string
): Promise<{
  total_insights: number;
  cross_app_insights: number;
  avg_confidence: number;
  insights_by_type: Record<InsightType, number>;
  insights_by_app: Record<string, number>;
}> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Get all insights visible to current app
  const insights = await executeQuery<InsightResponse[]>(
    () =>
      db
        .from('insights')
        .select('*')
        .eq('user_id', userId)
        .or(`source_app_id.eq.${appUuid},cross_app_visibility.eq.true`),
    'get user insights for stats'
  );

  // Calculate statistics
  const stats = {
    total_insights: insights.length,
    cross_app_insights: insights.filter((i) => i.cross_app_visibility).length,
    avg_confidence:
      insights.length > 0
        ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
        : 0,
    insights_by_type: {} as Record<InsightType, number>,
    insights_by_app: {} as Record<string, number>,
  };

  // Count by type
  insights.forEach((insight) => {
    stats.insights_by_type[insight.insight_type] =
      (stats.insights_by_type[insight.insight_type] || 0) + 1;
  });

  // Count by app
  insights.forEach((insight) => {
    stats.insights_by_app[insight.source_app_id] =
      (stats.insights_by_app[insight.source_app_id] || 0) + 1;
  });

  return stats;
};

/**
 * Delete insight
 */
export const deleteInsight = async (
  req: Request,
  insightId: string,
  userId: string
): Promise<void> => {
  validateUuid(insightId, 'insight_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Only allow deletion by source app
  await executeQuery(
    () =>
      db
        .from('insights')
        .delete()
        .eq('id', insightId)
        .eq('user_id', userId)
        .eq('source_app_id', appUuid),
    'delete insight'
  );
};
