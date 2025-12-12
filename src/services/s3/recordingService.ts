/**
 * S3 Recording Service
 * Manages audio recording storage for call transcription workflow
 *
 * Key Pattern: recordings/{organization_id}/{YYYY-MM}/{call_sid}.wav
 */

import * as AWS from 'aws-sdk';
import {
  S3RecordingUpload,
  S3UploadResult,
  S3PlaybackUrl,
  S3DeletionResult,
} from '../callTranscription/types';

// ============================================================================
// Configuration
// ============================================================================

const RECORDINGS_BUCKET = process.env.AWS_RECORDINGS_BUCKET || 'oriva-call-recordings';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Pre-signed URL expiry times
const PLAYBACK_URL_EXPIRY_SECONDS = 900; // 15 minutes

// ============================================================================
// S3 Client Initialization
// ============================================================================

const s3 = new AWS.S3({
  region: AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate S3 key for recording storage
 * Pattern: recordings/{organization_id}/{YYYY-MM}/{call_sid}.wav
 */
function generateRecordingKey(organizationId: string, callSid: string): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `recordings/${organizationId}/${yearMonth}/${callSid}.wav`;
}

/**
 * Extract organization ID from S3 key
 */
function extractOrgIdFromKey(s3Key: string): string | null {
  const parts = s3Key.split('/');
  // recordings/{org_id}/{year-month}/{call_sid}.wav
  if (parts.length >= 2 && parts[0] === 'recordings') {
    return parts[1];
  }
  return null;
}

// ============================================================================
// S3 Recording Service Class
// ============================================================================

class S3RecordingService {
  private bucket: string;

  constructor(bucket: string = RECORDINGS_BUCKET) {
    this.bucket = bucket;
  }

  /**
   * Upload recording from Twilio URL to S3
   *
   * Flow:
   * 1. Fetch audio from Twilio URL (requires auth)
   * 2. Stream upload to S3 with server-side encryption
   * 3. Return S3 key and metadata
   */
  async uploadFromTwilio(params: S3RecordingUpload): Promise<S3UploadResult> {
    const { organizationId, callSid, transcriptId, sourceUrl } = params;

    // Generate S3 key
    const s3Key = generateRecordingKey(organizationId, callSid);

    // Fetch audio from Twilio
    // Note: Twilio recording URLs require basic auth with account SID and auth token
    const twilioAuth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const response = await fetch(sourceUrl, {
      headers: {
        Authorization: `Basic ${twilioAuth}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch recording from Twilio: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3 with server-side encryption (AES-256)
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: 'audio/wav',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'transcript-id': transcriptId,
        'organization-id': organizationId,
        'call-sid': callSid,
        'uploaded-at': new Date().toISOString(),
      },
    };

    await s3.putObject(uploadParams).promise();

    const result: S3UploadResult = {
      s3Key,
      s3Bucket: this.bucket,
      sizeBytes: buffer.length,
      contentType: 'audio/wav',
      uploadedAt: new Date().toISOString(),
    };

    console.log(`[S3RecordingService] Uploaded recording: ${s3Key} (${buffer.length} bytes)`);

    return result;
  }

  /**
   * Generate pre-signed URL for audio playback
   * URL expires after 15 minutes for security
   */
  async getPlaybackUrl(s3Key: string): Promise<S3PlaybackUrl> {
    const expiresInSeconds = PLAYBACK_URL_EXPIRY_SECONDS;

    const url = await s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: s3Key,
      Expires: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return {
      url,
      expiresAt,
      expiresInSeconds,
    };
  }

  /**
   * Delete recording from S3 (GDPR data minimization)
   * Called after agent confirms transcript accuracy
   */
  async deleteRecording(s3Key: string, deletedBy: string): Promise<S3DeletionResult> {
    // Verify the object exists before deletion
    try {
      await s3
        .headObject({
          Bucket: this.bucket,
          Key: s3Key,
        })
        .promise();
    } catch (error: any) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        throw new Error(`Recording not found: ${s3Key}`);
      }
      throw error;
    }

    // Delete the object
    await s3
      .deleteObject({
        Bucket: this.bucket,
        Key: s3Key,
      })
      .promise();

    const result: S3DeletionResult = {
      s3Key,
      deletedAt: new Date().toISOString(),
      deletedBy,
    };

    console.log(`[S3RecordingService] Deleted recording: ${s3Key} by ${deletedBy}`);

    return result;
  }

  /**
   * Get recording metadata without downloading the file
   */
  async getRecordingMetadata(s3Key: string): Promise<{
    sizeBytes: number;
    contentType: string;
    lastModified: string;
    metadata: Record<string, string>;
  }> {
    const head = await s3
      .headObject({
        Bucket: this.bucket,
        Key: s3Key,
      })
      .promise();

    return {
      sizeBytes: head.ContentLength || 0,
      contentType: head.ContentType || 'audio/wav',
      lastModified: head.LastModified?.toISOString() || '',
      metadata: head.Metadata || {},
    };
  }

  /**
   * Check if a recording exists in S3
   */
  async recordingExists(s3Key: string): Promise<boolean> {
    try {
      await s3
        .headObject({
          Bucket: this.bucket,
          Key: s3Key,
        })
        .promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate S3 URL for Deepgram transcription
   * Returns a pre-signed URL that Deepgram can use to fetch the audio
   */
  async getTranscriptionUrl(s3Key: string): Promise<string> {
    // Deepgram needs longer access - 1 hour for transcription processing
    const url = await s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: s3Key,
      Expires: 3600, // 1 hour
    });

    return url;
  }

  /**
   * List recordings for an organization (for admin/audit purposes)
   */
  async listRecordings(
    organizationId: string,
    options: { limit?: number; continuationToken?: string } = {}
  ): Promise<{
    recordings: Array<{ key: string; size: number; lastModified: string }>;
    nextToken?: string;
  }> {
    const { limit = 100, continuationToken } = options;

    const listParams: AWS.S3.ListObjectsV2Request = {
      Bucket: this.bucket,
      Prefix: `recordings/${organizationId}/`,
      MaxKeys: limit,
      ContinuationToken: continuationToken,
    };

    const result = await s3.listObjectsV2(listParams).promise();

    const recordings = (result.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || '',
    }));

    return {
      recordings,
      nextToken: result.NextContinuationToken,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const s3RecordingService = new S3RecordingService();

export { S3RecordingService, generateRecordingKey, extractOrgIdFromKey };
