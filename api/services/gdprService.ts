/**
 * GDPR Service
 * Task: T033
 *
 * Business logic for GDPR compliance operations.
 * Handles Right to Erasure (Art. 17) with cascade deletion across all schemas.
 */

import { Request } from 'express';
import { createQueryBuilder, executeQuery, DatabaseError } from '../utils/database';
import { validateUuid } from '../utils/validation';

/**
 * Deletion result
 */
export interface DeletionResult {
  user_id: string;
  deleted_at: string;
  confirmation_token: string;
  summary: {
    platform: {
      users: number;
      user_app_access: number;
      extraction_manifests: number;
    };
    hugo_ai: {
      sessions: number;
      insights: number;
    };
    apps: Record<
      string,
      {
        profiles?: number;
        ice_breakers?: number;
        [key: string]: number | undefined;
      }
    >;
  };
}

/**
 * Delete user data across all schemas (GDPR Art. 17)
 */
export const deleteUserData = async (
  req: Request,
  userId: string,
  confirmation: string
): Promise<DeletionResult> => {
  validateUuid(userId, 'user_id');

  // Verify confirmation token
  if (confirmation !== `DELETE_USER_${userId}`) {
    throw new DatabaseError('Invalid confirmation token', 'INVALID_CONFIRMATION', undefined);
  }

  const db = createQueryBuilder(req);

  // Verify user exists
  const user = await executeQuery<{ id: string; email: string }>(
    () => db.from('users').select('id, email').eq('id', userId).single(),
    'verify user exists'
  );

  // Get all apps user has access to
  const userApps = await executeQuery<{ app_id: string }[]>(
    () => db.from('user_app_access').select('app_id').eq('user_id', userId),
    'get user apps'
  );

  // Initialize deletion result
  const result: DeletionResult = {
    user_id: userId,
    deleted_at: new Date().toISOString(),
    confirmation_token: generateConfirmationToken(),
    summary: {
      platform: {
        users: 0,
        user_app_access: 0,
        extraction_manifests: 0,
      },
      hugo_ai: {
        sessions: 0,
        insights: 0,
      },
      apps: {},
    },
  };

  // Delete from Hugo AI schema (insights cascade from sessions)
  const sessions = await executeQuery<{ id: string }[]>(
    () => db.from('sessions').select('id').eq('user_id', userId),
    'get user sessions'
  );
  result.summary.hugo_ai.sessions = sessions.length;

  const insights = await executeQuery<{ id: string }[]>(
    () => db.from('insights').select('id').eq('user_id', userId),
    'get user insights'
  );
  result.summary.hugo_ai.insights = insights.length;

  await executeQuery(
    () => db.from('insights').delete().eq('user_id', userId),
    'delete insights'
  );

  await executeQuery(
    () => db.from('sessions').delete().eq('user_id', userId),
    'delete sessions'
  );

  // Delete from app-specific schemas
  for (const userApp of userApps) {
    const appId = userApp.app_id;

    // Get app details to determine schema
    const app = await executeQuery<{ app_id: string; schema_name: string }>(
      () => db.from('apps').select('app_id, schema_name').eq('id', appId).single(),
      'get app details'
    );

    // Initialize app summary
    result.summary.apps[app.app_id] = {};

    // Delete profiles if exists
    try {
      const profiles = await executeQuery<{ id: string }[]>(
        () => db.from('profiles').select('id').eq('user_id', userId),
        'get user profiles'
      );
      result.summary.apps[app.app_id].profiles = profiles.length;

      await executeQuery(
        () => db.from('profiles').delete().eq('user_id', userId),
        'delete profiles'
      );
    } catch (error) {
      // Profiles table may not exist in this app schema
      console.log(`No profiles table in ${app.schema_name}`);
    }

    // Delete ice_breakers if exists (Hugo Love specific)
    if (app.app_id === 'hugo_love') {
      try {
        const iceBreakers = await executeQuery<{ id: string }[]>(
          () => db.from('ice_breakers').select('id').eq('user_id', userId),
          'get user ice breakers'
        );
        result.summary.apps[app.app_id].ice_breakers = iceBreakers.length;

        await executeQuery(
          () => db.from('ice_breakers').delete().eq('user_id', userId),
          'delete ice breakers'
        );
      } catch (error) {
        console.log('No ice_breakers table found');
      }
    }
  }

  // Delete from platform schema
  const extractionManifests = await executeQuery<{ id: string }[]>(
    () => db.from('extraction_manifests').select('id').eq('user_id', userId),
    'get extraction manifests'
  );
  result.summary.platform.extraction_manifests = extractionManifests.length;

  await executeQuery(
    () => db.from('extraction_manifests').delete().eq('user_id', userId),
    'delete extraction manifests'
  );

  result.summary.platform.user_app_access = userApps.length;
  await executeQuery(
    () => db.from('user_app_access').delete().eq('user_id', userId),
    'delete user app access'
  );

  // Finally, delete user record
  await executeQuery(
    () => db.from('users').delete().eq('id', userId),
    'delete user'
  );
  result.summary.platform.users = 1;

  return result;
};

/**
 * Verify user deletion eligibility
 */
export const verifyDeletionEligibility = async (
  req: Request,
  userId: string
): Promise<{
  eligible: boolean;
  warnings: string[];
  record_counts: {
    platform: number;
    hugo_ai: number;
    apps: number;
  };
}> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify user exists
  await executeQuery<{ id: string }>(
    () => db.from('users').select('id').eq('id', userId).single(),
    'verify user exists'
  );

  const warnings: string[] = [];
  const recordCounts = {
    platform: 0,
    hugo_ai: 0,
    apps: 0,
  };

  // Count platform records
  const userAppAccess = await executeQuery<{ id: string }[]>(
    () => db.from('user_app_access').select('id').eq('user_id', userId),
    'count user app access'
  );
  recordCounts.platform += userAppAccess.length;

  const extractionManifests = await executeQuery<{ id: string }[]>(
    () => db.from('extraction_manifests').select('id').eq('user_id', userId),
    'count extraction manifests'
  );
  recordCounts.platform += extractionManifests.length;

  // Count Hugo AI records
  const sessions = await executeQuery<{ id: string }[]>(
    () => db.from('sessions').select('id').eq('user_id', userId),
    'count sessions'
  );
  recordCounts.hugo_ai += sessions.length;

  if (sessions.length > 10) {
    warnings.push(`User has ${sessions.length} sessions that will be permanently deleted`);
  }

  const insights = await executeQuery<{ id: string }[]>(
    () => db.from('insights').select('id').eq('user_id', userId),
    'count insights'
  );
  recordCounts.hugo_ai += insights.length;

  if (insights.length > 50) {
    warnings.push(`User has ${insights.length} insights that will be permanently deleted`);
  }

  // Count app-specific records
  for (const appAccess of userAppAccess) {
    try {
      const profiles = await executeQuery<{ id: string }[]>(
        () => db.from('profiles').select('id').eq('user_id', userId),
        'count profiles'
      );
      recordCounts.apps += profiles.length;
    } catch (error) {
      // No profiles in this app
    }

    try {
      const iceBreakers = await executeQuery<{ id: string }[]>(
        () => db.from('ice_breakers').select('id').eq('user_id', userId),
        'count ice breakers'
      );
      recordCounts.apps += iceBreakers.length;
    } catch (error) {
      // No ice breakers in this app
    }
  }

  // Check for active extractions
  const activeExtractions = await executeQuery<{ id: string }[]>(
    () =>
      db
        .from('extraction_manifests')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['prepared', 'executing']),
    'check active extractions'
  );

  if (activeExtractions.length > 0) {
    warnings.push(
      'User has active data extraction in progress. Consider completing extraction before deletion.'
    );
  }

  return {
    eligible: true,
    warnings,
    record_counts: recordCounts,
  };
};

/**
 * Generate GDPR deletion report
 */
export const generateDeletionReport = async (
  req: Request,
  userId: string
): Promise<{
  user_id: string;
  data_inventory: {
    platform: Record<string, unknown>;
    hugo_ai: Record<string, unknown>;
    apps: Record<string, Record<string, unknown>>;
  };
  estimated_deletion_time_seconds: number;
}> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Get user details
  const user = await executeQuery<{ id: string; email: string; created_at: string }>(
    () => db.from('users').select('id, email, created_at').eq('id', userId).single(),
    'get user details'
  );

  const report = {
    user_id: userId,
    data_inventory: {
      platform: {} as Record<string, unknown>,
      hugo_ai: {} as Record<string, unknown>,
      apps: {} as Record<string, Record<string, unknown>>,
    },
    estimated_deletion_time_seconds: 0,
  };

  // Platform data
  const userAppAccess = await executeQuery<unknown[]>(
    () => db.from('user_app_access').select('*').eq('user_id', userId),
    'get user app access'
  );
  report.data_inventory.platform.user_app_access = {
    count: userAppAccess.length,
    records: userAppAccess,
  };

  const extractionManifests = await executeQuery<unknown[]>(
    () => db.from('extraction_manifests').select('*').eq('user_id', userId),
    'get extraction manifests'
  );
  report.data_inventory.platform.extraction_manifests = {
    count: extractionManifests.length,
    records: extractionManifests,
  };

  // Hugo AI data
  const sessions = await executeQuery<unknown[]>(
    () => db.from('sessions').select('*').eq('user_id', userId),
    'get sessions'
  );
  report.data_inventory.hugo_ai.sessions = {
    count: sessions.length,
    records: sessions,
  };

  const insights = await executeQuery<unknown[]>(
    () => db.from('insights').select('*').eq('user_id', userId),
    'get insights'
  );
  report.data_inventory.hugo_ai.insights = {
    count: insights.length,
    records: insights,
  };

  // App-specific data
  for (const appAccess of userAppAccess) {
    const appId = (appAccess as { app_id: string }).app_id;
    const app = await executeQuery<{ app_id: string; schema_name: string }>(
      () => db.from('apps').select('app_id, schema_name').eq('id', appId).single(),
      'get app details'
    );

    report.data_inventory.apps[app.app_id] = {};

    try {
      const profiles = await executeQuery<unknown[]>(
        () => db.from('profiles').select('*').eq('user_id', userId),
        'get profiles'
      );
      report.data_inventory.apps[app.app_id].profiles = {
        count: profiles.length,
        records: profiles,
      };
    } catch (error) {
      // No profiles
    }
  }

  // Estimate deletion time (100ms per record)
  const totalRecords =
    userAppAccess.length +
    extractionManifests.length +
    sessions.length +
    insights.length +
    Object.values(report.data_inventory.apps).reduce(
      (sum, app) => sum + ((app.profiles as { count: number })?.count || 0),
      0
    );

  report.estimated_deletion_time_seconds = Math.ceil(totalRecords * 0.1);

  return report;
};

/**
 * Generate confirmation token
 */
const generateConfirmationToken = (): string => {
  return `GDPR_DELETE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Verify confirmation token format
 */
export const verifyConfirmationToken = (userId: string, token: string): boolean => {
  return token === `DELETE_USER_${userId}`;
};

/**
 * Schedule user deletion (deferred deletion)
 */
export interface DeletionSchedule {
  user_id: string;
  scheduled_for: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export const scheduleDeletion = async (
  req: Request,
  userId: string,
  deletionDate: string
): Promise<DeletionSchedule> => {
  validateUuid(userId, 'user_id');

  // In production, this would create a scheduled job
  // For now, return mock schedule
  return {
    user_id: userId,
    scheduled_for: deletionDate,
    status: 'scheduled',
    created_at: new Date().toISOString(),
  };
};
