/**
 * Extraction Service
 * Task: T032
 *
 * Business logic for GDPR data extraction (Right to Data Portability - Art. 20).
 * Handles manifest creation and data export across all schemas.
 */

import { Request } from 'express';
import {
  createQueryBuilder,
  executeQuery,
  generateExpirationDate,
  isExpired,
  DatabaseError,
} from '../utils/database-express';
import { validateUuid } from '../utils/validation-express';

/**
 * Extraction manifest status
 */
export type ExtractionStatus = 'prepared' | 'executing' | 'completed' | 'failed' | 'expired';

/**
 * Extraction manifest response
 */
export interface ExtractionManifestResponse {
  id: string;
  user_id: string;
  status: ExtractionStatus;
  download_url?: string;
  data_summary?: {
    total_records: number;
    schemas_included: string[];
    data_types: Record<string, number>;
  };
  expires_at: string;
  created_at: string;
  completed_at?: string;
}

/**
 * Prepare data extraction for user
 */
export const prepareExtraction = async (
  req: Request,
  userId: string
): Promise<ExtractionManifestResponse> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify user exists
  const userExists = await executeQuery<{ id: string }>(
    () => db.from('users').select('id').eq('id', userId).single(),
    'verify user exists'
  );

  // Check for existing active manifests
  const existingManifest = await executeQuery<ExtractionManifestResponse[]>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['prepared', 'executing'])
        .order('created_at', { ascending: false })
        .limit(1),
    'check existing manifests'
  );

  if (existingManifest.length > 0) {
    throw new DatabaseError(
      'An extraction is already in progress for this user',
      'EXTRACTION_IN_PROGRESS',
      undefined
    );
  }

  // Create manifest
  const manifest = await executeQuery<ExtractionManifestResponse>(
    () =>
      db
        .from('extraction_manifests')
        .insert({
          user_id: userId,
          status: 'prepared',
          expires_at: generateExpirationDate(7),
        })
        .select()
        .single(),
    'create extraction manifest'
  );

  return manifest;
};

/**
 * Execute data extraction and generate download
 */
export const executeExtraction = async (
  req: Request,
  manifestId: string,
  userId: string
): Promise<ExtractionManifestResponse> => {
  validateUuid(manifestId, 'manifest_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify manifest exists and belongs to user
  const manifest = await executeQuery<ExtractionManifestResponse>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .eq('id', manifestId)
        .eq('user_id', userId)
        .single(),
    'get extraction manifest'
  );

  // Check if expired
  if (isExpired(manifest.expires_at)) {
    await executeQuery(
      () =>
        db
          .from('extraction_manifests')
          .update({ status: 'expired' })
          .eq('id', manifestId),
      'mark manifest as expired'
    );
    throw new DatabaseError('Extraction manifest has expired', 'MANIFEST_EXPIRED', undefined);
  }

  // Check status
  if (manifest.status !== 'prepared') {
    throw new DatabaseError(
      `Extraction cannot be executed from status: ${manifest.status}`,
      'INVALID_STATUS',
      undefined
    );
  }

  // Update status to executing
  await executeQuery(
    () =>
      db
        .from('extraction_manifests')
        .update({ status: 'executing' })
        .eq('id', manifestId),
    'update manifest status to executing'
  );

  try {
    // Extract data from all schemas
    const extractedData = await extractUserData(req, userId);

    // Generate download URL (in production, this would upload to S3 and return signed URL)
    const downloadUrl = generateDownloadUrl(manifestId);

    // Update manifest with results
    const completedManifest = await executeQuery<ExtractionManifestResponse>(
      () =>
        db
          .from('extraction_manifests')
          .update({
            status: 'completed',
            download_url: downloadUrl,
            data_summary: extractedData.summary,
            completed_at: new Date().toISOString(),
          })
          .eq('id', manifestId)
          .select()
          .single(),
      'complete extraction'
    );

    return completedManifest;
  } catch (error) {
    // Mark as failed
    await executeQuery(
      () =>
        db
          .from('extraction_manifests')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', manifestId),
      'mark extraction as failed'
    );

    throw error;
  }
};

/**
 * Get extraction manifest by ID
 */
export const getExtraction = async (
  req: Request,
  manifestId: string,
  userId: string
): Promise<ExtractionManifestResponse> => {
  validateUuid(manifestId, 'manifest_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const manifest = await executeQuery<ExtractionManifestResponse>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .eq('id', manifestId)
        .eq('user_id', userId)
        .single(),
    'get extraction manifest'
  );

  // Check if expired
  if (manifest.status === 'completed' && isExpired(manifest.expires_at)) {
    await executeQuery(
      () =>
        db
          .from('extraction_manifests')
          .update({ status: 'expired', download_url: null })
          .eq('id', manifestId),
      'mark manifest as expired'
    );
    manifest.status = 'expired';
    manifest.download_url = undefined;
  }

  return manifest;
};

/**
 * List user's extraction manifests
 */
export const listExtractions = async (
  req: Request,
  userId: string
): Promise<{ extractions: ExtractionManifestResponse[] }> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const extractions = await executeQuery<ExtractionManifestResponse[]>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    'list extractions'
  );

  return { extractions };
};

/**
 * Cancel extraction
 */
export const cancelExtraction = async (
  req: Request,
  manifestId: string,
  userId: string
): Promise<void> => {
  validateUuid(manifestId, 'manifest_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify manifest exists and can be cancelled
  const manifest = await executeQuery<ExtractionManifestResponse>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .eq('id', manifestId)
        .eq('user_id', userId)
        .single(),
    'get extraction manifest'
  );

  if (!['prepared', 'executing'].includes(manifest.status)) {
    throw new DatabaseError(
      `Cannot cancel extraction with status: ${manifest.status}`,
      'INVALID_STATUS',
      undefined
    );
  }

  await executeQuery(
    () =>
      db
        .from('extraction_manifests')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', manifestId),
    'cancel extraction'
  );
};

/**
 * Delete expired manifests (cleanup job)
 */
export const cleanupExpiredManifests = async (req: Request): Promise<number> => {
  const db = createQueryBuilder(req);

  const now = new Date().toISOString();

  // Get expired manifests
  const expiredManifests = await executeQuery<ExtractionManifestResponse[]>(
    () =>
      db
        .from('extraction_manifests')
        .select('*')
        .lt('expires_at', now)
        .neq('status', 'expired'),
    'get expired manifests'
  );

  // Update status to expired
  if (expiredManifests.length > 0) {
    await executeQuery(
      () =>
        db
          .from('extraction_manifests')
          .update({ status: 'expired', download_url: null })
          .lt('expires_at', now)
          .neq('status', 'expired'),
      'cleanup expired manifests'
    );
  }

  return expiredManifests.length;
};

/**
 * Extract all user data from all schemas
 */
interface ExtractedData {
  summary: {
    total_records: number;
    schemas_included: string[];
    data_types: Record<string, number>;
  };
  data: {
    platform: unknown;
    hugo_ai: unknown;
    apps: Record<string, unknown>;
  };
}

const extractUserData = async (req: Request, userId: string): Promise<ExtractedData> => {
  const db = createQueryBuilder(req);

  const extractedData: ExtractedData = {
    summary: {
      total_records: 0,
      schemas_included: ['oriva_platform', 'hugo_ai'],
      data_types: {},
    },
    data: {
      platform: {},
      hugo_ai: {},
      apps: {},
    },
  };

  // Extract platform data (user record)
  const user = await executeQuery<{ id: string; email: string; created_at: string }>(
    () => db.from('users').select('id, email, created_at').eq('id', userId).single(),
    'extract user data'
  );
  extractedData.data.platform = { user };
  extractedData.summary.total_records += 1;
  extractedData.summary.data_types['users'] = 1;

  // Extract user_app_access
  const userApps = await executeQuery<unknown[]>(
    () => db.from('user_app_access').select('*').eq('user_id', userId),
    'extract user app access'
  );
  (extractedData.data.platform as Record<string, unknown>).user_app_access = userApps;
  extractedData.summary.total_records += userApps.length;
  extractedData.summary.data_types['user_app_access'] = userApps.length;

  // Extract Hugo AI data (sessions)
  const sessions = await executeQuery<unknown[]>(
    () => db.from('sessions').select('*').eq('user_id', userId),
    'extract sessions'
  );
  (extractedData.data.hugo_ai as Record<string, unknown>).sessions = sessions;
  extractedData.summary.total_records += sessions.length;
  extractedData.summary.data_types['sessions'] = sessions.length;

  // Extract insights
  const insights = await executeQuery<unknown[]>(
    () => db.from('insights').select('*').eq('user_id', userId),
    'extract insights'
  );
  (extractedData.data.hugo_ai as Record<string, unknown>).insights = insights;
  extractedData.summary.total_records += insights.length;
  extractedData.summary.data_types['insights'] = insights.length;

  // Extract app-specific data (profiles)
  // Note: In production, this would iterate through all user's apps
  try {
    const profiles = await executeQuery<unknown[]>(
      () => db.from('profiles').select('*').eq('user_id', userId),
      'extract profiles'
    );
    extractedData.data.apps = { profiles };
    extractedData.summary.total_records += profiles.length;
    extractedData.summary.data_types['profiles'] = profiles.length;
    extractedData.summary.schemas_included.push(req.appContext?.schemaName || 'unknown');
  } catch (error) {
    // Profile may not exist in current app schema
    console.log('No profiles found in current app schema');
  }

  return extractedData;
};

/**
 * Generate download URL (mock - in production would use S3 signed URL)
 */
const generateDownloadUrl = (manifestId: string): string => {
  return `/api/v1/platform/extraction/${manifestId}/download`;
};
