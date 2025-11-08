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
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter } from '../middleware/schemaRouter';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

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

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'oriva-user-photos';
const UPLOAD_URL_EXPIRY = 300; // 5 minutes

// Interfaces
interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  photoType: 'profile' | 'gallery';
}

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

interface ConfirmUploadRequest {
  key: string;
  photoType: 'profile' | 'gallery';
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

const generateS3Key = (userId: string, fileName: string, contentType: string): string => {
  const timestamp = Date.now();
  const uniqueId = uuidv4();
  const extension = getFileExtension(fileName, contentType);
  return `${userId}/${timestamp}-${uniqueId}.${extension}`;
};

/**
 * POST /api/v1/apps/photos/upload-url
 * Generate pre-signed URL for photo upload
 */
router.post(
  '/upload-url',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
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

    if (!['profile', 'gallery'].includes(photoType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'photoType must be either "profile" or "gallery"',
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
    const key = generateS3Key(userId, fileName, contentType);

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
      console.error('Error generating pre-signed URL:', error);
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
  requireAuthentication,
  requireAppAccess,
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

    if (!['profile', 'gallery'].includes(photoType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'photoType must be either "profile" or "gallery"',
      });
      return;
    }

    // Verify the key belongs to this user (security check)
    if (!key.startsWith(`${userId}/`)) {
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

      // Generate public URL (only if approved)
      const publicUrl = isApproved
        ? `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
        : '';

      // Generate a simple photo ID (you might want to store this in database)
      const photoId = uuidv4();

      const response: ConfirmUploadResponse = {
        photoId,
        status,
        publicUrl,
        moderationLabels: inappropriateLabels.length > 0 ? inappropriateLabels : undefined,
      };

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
      console.error('Error confirming upload:', error);

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
