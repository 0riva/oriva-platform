/**
 * Photos Routes
 *
 * API endpoints for pre-signed URL photo uploads with AWS S3.
 * Routes: POST /photos/upload-url, POST /photos/confirm
 */

import { Router } from 'express';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireJwtAuth } from '../middleware/auth';
import { optionalSchemaRouter } from '../middleware/schemaRouter';
import { getSupabaseServiceClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

const router = Router();

// Photos route doesn't need mandatory schema routing - S3 uploads are app-agnostic
// User-based path isolation (profiles/{userId}/*) handles separation
router.use(optionalSchemaRouter);

// Configure AWS SDK
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

const rekognition = new AWS.Rekognition({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'oriva-media-storage';
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || 'dj9em15b7x04y.cloudfront.net';
const UPLOAD_URL_EXPIRY = 300; // 5 minutes

// Interfaces
interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  photoType: 'profile' | 'gallery' | 'avatar';
}

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

interface ConfirmUploadRequest {
  key: string;
  photoType: 'profile' | 'gallery' | 'avatar';
}

interface ConfirmUploadResponse {
  photoId: string;
  status: 'validating' | 'approved' | 'rejected';
  publicUrl: string;
  moderationLabels?: string[];
}

// Validation helpers
const isValidContentType = (contentType: string): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  return validTypes.includes(contentType.toLowerCase());
};

const getFileExtension = (fileName: string, contentType: string): string => {
  // Try to extract from filename first
  const fileNameParts = fileName.split('.');
  if (fileNameParts.length > 1) {
    const ext = fileNameParts[fileNameParts.length - 1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
      return ext;
    }
  }

  // Fall back to content type
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };

  return typeMap[contentType.toLowerCase()] || 'jpg';
};

const generateS3Key = (
  userId: string,
  fileName: string,
  contentType: string,
  photoType: string = 'media'
): string => {
  const timestamp = Date.now();
  const uniqueId = uuidv4();
  const extension = getFileExtension(fileName, contentType);
  // Organize by type: avatars/, profiles/, gallery/, media/
  const typePrefix =
    photoType === 'avatar' ? 'avatars' : photoType === 'profile' ? 'profiles' : 'gallery';
  return `${typePrefix}/${userId}/${timestamp}-${uniqueId}.${extension}`;
};

/**
 * Execute SQL via RPC to access hugo_love schema
 * PostgREST doesn't expose hugo_love schema, so we use exec_sql RPC
 */
async function execHugoLoveSql(sql: string): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    logger.error('Hugo Love SQL error', { error });
    throw error;
  }

  return data as string;
}

/**
 * Query hugo_love schema and return results
 * Uses exec_sql_query RPC which returns JSONB array of results
 */
async function queryHugoLoveSql(sql: string): Promise<any[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await (supabase.rpc as any)('exec_sql_query', { sql_query: sql });

  if (error) {
    logger.error('Hugo Love query error', { error });
    throw error;
  }

  return (data as any[]) || [];
}

/**
 * Append photo URL to Hugo Love profile_photos array
 * Uses exec_sql RPC to bypass PostgREST schema restrictions
 *
 * Schema: hugo_love.dating_profiles (NOT love_profiles!)
 * Column: profile_photos (jsonb array)
 * Key: user_id
 */
const appendPhotoToHugoLoveProfile = async (userId: string, photoUrl: string): Promise<void> => {
  // First, get the current profile_photos array from dating_profiles
  const fetchSql = `
    SELECT profile_photos FROM hugo_love.dating_profiles
    WHERE user_id = '${userId}'
    LIMIT 1
  `;

  const result = await queryHugoLoveSql(fetchSql);

  if (result.length === 0) {
    // No profile exists - create one with just the photo
    logger.info('Creating Hugo Love profile with photo', { userId });
    const insertSql = `
      INSERT INTO hugo_love.dating_profiles (user_id, profile_photos, display_name, created_at, updated_at)
      VALUES ('${userId}', '["${photoUrl}"]'::jsonb, 'New User', NOW(), NOW())
    `;
    await execHugoLoveSql(insertSql);
    return;
  }

  // Append the new photo URL to the existing array (or create new array if null)
  const currentPhotos = (result[0]?.profile_photos as string[]) || [];
  const updatedPhotos = [...currentPhotos, photoUrl];

  // Escape the JSON array for SQL (profile_photos is jsonb)
  const photosJson = JSON.stringify(updatedPhotos).replace(/'/g, "''");

  // Update the profile with the new photos array
  const updateSql = `
    UPDATE hugo_love.dating_profiles
    SET profile_photos = '${photosJson}'::jsonb,
        updated_at = NOW()
    WHERE user_id = '${userId}'
  `;

  await execHugoLoveSql(updateSql);
};

/**
 * Append photo URL to Love Puzl profile_photos array
 * Uses exec_sql RPC to bypass PostgREST schema restrictions
 *
 * Schema: love_puzl.dating_profiles
 * Column: profile_photos (jsonb array)
 * Key: oriva_profile_id (NOT user_id - Love Puzl uses profile-based identity)
 */
const appendPhotoToLovePuzlProfile = async (
  orivaProfileId: string,
  photoUrl: string
): Promise<void> => {
  // First, get the current profile_photos array from dating_profiles
  // Use oriva_profile_id since Love Puzl uses profile-based identity (DID)
  const fetchSql = `
    SELECT profile_photos FROM love_puzl.dating_profiles
    WHERE oriva_profile_id = '${orivaProfileId}'
    LIMIT 1
  `;

  const result = await queryHugoLoveSql(fetchSql);

  if (result.length === 0) {
    // No profile exists - log warning since Love Puzl profiles should be created via tenant API
    logger.warn('No Love Puzl profile found for photo upload', { orivaProfileId });
    return;
  }

  // Append the new photo URL to the existing array (or create new array if null)
  const currentPhotos = (result[0]?.profile_photos as string[]) || [];
  const updatedPhotos = [...currentPhotos, photoUrl];

  // Escape the JSON array for SQL (profile_photos is jsonb)
  const photosJson = JSON.stringify(updatedPhotos).replace(/'/g, "''");

  // Update the profile with the new photos array
  const updateSql = `
    UPDATE love_puzl.dating_profiles
    SET profile_photos = '${photosJson}'::jsonb,
        updated_at = NOW()
    WHERE oriva_profile_id = '${orivaProfileId}'
  `;

  await execHugoLoveSql(updateSql);
  logger.info('Photo appended to Love Puzl profile', {
    orivaProfileId,
    photoCount: updatedPhotos.length,
  });
};

/**
 * POST /api/v1/apps/photos/upload-url
 * Generate pre-signed URL for photo upload
 */
router.post(
  '/upload-url',
  requireApiKey,
  requireJwtAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const { fileName, contentType, photoType }: UploadUrlRequest = req.body;

    // Validation
    if (!fileName || !contentType || !photoType) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'fileName, contentType, and photoType are required',
      });
      return;
    }

    if (!['profile', 'gallery', 'avatar'].includes(photoType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'photoType must be "profile", "gallery", or "avatar"',
      });
      return;
    }

    if (!isValidContentType(contentType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid content type. Supported: image/jpeg, image/png, image/webp, image/heic',
      });
      return;
    }

    // Generate S3 key
    const key = generateS3Key(userId, fileName, contentType, photoType);

    // Generate pre-signed URL
    try {
      const uploadUrl = await s3.getSignedUrlPromise('putObject', {
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Expires: UPLOAD_URL_EXPIRY,
      });

      const response: UploadUrlResponse = {
        uploadUrl,
        key,
        expiresIn: UPLOAD_URL_EXPIRY,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error generating pre-signed URL', { error });
      res.status(500).json({
        code: 'S3_ERROR',
        message: 'Failed to generate upload URL',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  })
);

/**
 * POST /api/v1/apps/photos/confirm
 * Confirm upload and trigger AWS Rekognition validation
 */
router.post(
  '/confirm',
  requireApiKey,
  requireJwtAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const { key, photoType }: ConfirmUploadRequest = req.body;

    // Validation
    if (!key || !photoType) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'key and photoType are required',
      });
      return;
    }

    if (!['profile', 'gallery', 'avatar'].includes(photoType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'photoType must be "profile", "gallery", or "avatar"',
      });
      return;
    }

    // Verify the key belongs to this user (security check)
    // Keys are now formatted as: {type}/{userId}/{timestamp}-{uuid}.{ext}
    const keyParts = key.split('/');
    const keyUserId = keyParts.length >= 2 ? keyParts[1] : null;
    if (keyUserId !== userId) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Cannot confirm upload for another user',
      });
      return;
    }

    try {
      // Check if object exists in S3
      await s3
        .headObject({
          Bucket: BUCKET_NAME,
          Key: key,
        })
        .promise();

      // Run AWS Rekognition content moderation
      const moderationResult = await rekognition
        .detectModerationLabels({
          Image: {
            S3Object: {
              Bucket: BUCKET_NAME,
              Name: key,
            },
          },
          MinConfidence: 60, // 60% confidence threshold
        })
        .promise();

      // Extract moderation labels
      const moderationLabels =
        moderationResult.ModerationLabels?.map((label) => label.Name || '') || [];

      // Determine approval status
      // Reject if any moderation labels are found above threshold
      const inappropriateLabels = moderationLabels.filter((label) => {
        // You can customize this logic based on specific labels you want to block
        const blockList = [
          'Explicit Nudity',
          'Nudity',
          'Sexual Activity',
          'Graphic Violence',
          'Violence',
          'Visually Disturbing',
        ];
        return blockList.some((blocked) => label.includes(blocked));
      });

      const isApproved = inappropriateLabels.length === 0;
      const status: 'validating' | 'approved' | 'rejected' = isApproved ? 'approved' : 'rejected';

      // Generate public URL via CloudFront (only if approved)
      // Note: Direct S3 URLs are blocked by bucket policy - must use CloudFront
      const publicUrl = isApproved ? `https://${CLOUDFRONT_DOMAIN}/${key}` : '';

      // Generate a simple photo ID (you might want to store this in database)
      const photoId = uuidv4();

      const response: ConfirmUploadResponse = {
        photoId,
        status,
        publicUrl,
        moderationLabels: inappropriateLabels.length > 0 ? inappropriateLabels : undefined,
      };

      // If approved and it's a profile photo for Hugo Love, persist to database
      if (isApproved && photoType === 'profile') {
        const appId = req.headers['x-app-id'] as string | undefined;
        // Use X-Profile-ID header if provided, otherwise fall back to userId from JWT
        const profileIdHeader = req.headers['x-profile-id'] as string | undefined;
        const effectiveUserId = profileIdHeader || userId;

        if (appId === 'hugo_love') {
          try {
            await appendPhotoToHugoLoveProfile(effectiveUserId, publicUrl);
          } catch (dbError) {
            logger.error('Photo uploaded but failed to persist to profile', {
              error: (dbError as Error)?.message,
              userId: effectiveUserId,
              publicUrl,
            });
          }
        } else if (appId === 'love_puzl') {
          // Love Puzl uses oriva_profile_id (from X-Profile-ID header) not user_id
          const orivaProfileId = profileIdHeader;
          if (orivaProfileId) {
            try {
              await appendPhotoToLovePuzlProfile(orivaProfileId, publicUrl);
            } catch (dbError) {
              logger.error('Photo uploaded but failed to persist to Love Puzl profile', {
                error: (dbError as Error)?.message,
                orivaProfileId,
                publicUrl,
              });
            }
          } else {
            logger.warn('Love Puzl photo upload missing X-Profile-ID header', { userId });
          }
        }
      }

      // If rejected, optionally delete the file from S3
      if (!isApproved) {
        await s3
          .deleteObject({
            Bucket: BUCKET_NAME,
            Key: key,
          })
          .promise();
      }

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Error confirming upload', { error });

      // Handle S3 object not found
      if (error.code === 'NotFound' || error.statusCode === 404) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Photo not found in storage',
        });
        return;
      }

      // Handle Rekognition errors
      if (error.code === 'InvalidImageFormatException') {
        res.status(400).json({
          code: 'INVALID_IMAGE',
          message: 'Invalid image format',
        });
        return;
      }

      res.status(500).json({
        code: 'UPLOAD_CONFIRMATION_ERROR',
        message: 'Failed to confirm upload',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

export default router;
