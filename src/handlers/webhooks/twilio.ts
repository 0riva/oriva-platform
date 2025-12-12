/**
 * Twilio Recording Webhook Handler
 *
 * Handles recording status callbacks from Twilio:
 * - recording-started: Update transcript status to 'recording'
 * - recording-completed: Upload to S3, trigger transcription
 * - recording-failed: Update status to 'failed' with error
 *
 * Security:
 * - Validates Twilio request signature
 * - Uses raw request body for signature verification
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Twilio from 'twilio';
import { s3RecordingService } from '../../services/s3/recordingService';
import { deepgramService } from '../../services/deepgram/deepgramService';
import type {
  TwilioRecordingWebhookPayload,
  RecordingStatus,
} from '../../services/twilio/twilioTypes';
import type { TranscriptStatus } from '../../services/callTranscription/types';

// ============================================================================
// Configuration
// ============================================================================

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// Signature Verification
// ============================================================================

function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('[TwilioWebhook] Auth token not configured, skipping signature verification');
    return true;
  }

  try {
    return Twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
  } catch (error) {
    console.error('[TwilioWebhook] Signature verification error:', error);
    return false;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle recording-started event
 */
async function handleRecordingStarted(payload: TwilioRecordingWebhookPayload): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { CallSid, RecordingSid, TranscriptId } = payload;

  if (!TranscriptId) {
    console.warn(`[TwilioWebhook] No TranscriptId in recording-started for ${CallSid}`);
    return;
  }

  // Update transcript status
  const { error } = await supabase
    .from('call_transcripts')
    .update({
      status: 'recording' as TranscriptStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', TranscriptId)
    .eq('call_sid', CallSid);

  if (error) {
    console.error(`[TwilioWebhook] Failed to update transcript ${TranscriptId}:`, error);
    throw error;
  }

  console.log(`[TwilioWebhook] Recording started for transcript ${TranscriptId}`);
}

/**
 * Handle recording-completed event
 * Uploads recording to S3 and triggers transcription
 */
async function handleRecordingCompleted(payload: TwilioRecordingWebhookPayload): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { CallSid, RecordingSid, RecordingUrl, RecordingDuration, TranscriptId, OrganizationId } =
    payload;

  // Find the transcript
  let transcriptId = TranscriptId;
  let organizationId = OrganizationId;

  if (!transcriptId) {
    // Look up by call_sid
    const { data: transcript, error } = await supabase
      .from('call_transcripts')
      .select('id, organization_id')
      .eq('call_sid', CallSid)
      .single();

    if (error || !transcript) {
      console.error(`[TwilioWebhook] Transcript not found for CallSid ${CallSid}`);
      throw new Error(`Transcript not found for CallSid ${CallSid}`);
    }

    transcriptId = transcript.id;
    organizationId = transcript.organization_id;
  }

  // 1. Update status to processing
  await supabase
    .from('call_transcripts')
    .update({
      status: 'processing' as TranscriptStatus,
      recording_duration_seconds: RecordingDuration ? parseInt(RecordingDuration, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);

  // 2. Upload recording to S3
  const s3Result = await s3RecordingService.uploadFromTwilio({
    organizationId: organizationId!,
    callSid: CallSid,
    transcriptId: transcriptId!,
    sourceUrl: `${RecordingUrl}.wav`, // Append .wav for full quality
  });

  // 3. Update transcript with S3 details
  await supabase
    .from('call_transcripts')
    .update({
      recording_url: s3Result.s3Key,
      recording_s3_key: s3Result.s3Key,
      recording_size_bytes: s3Result.sizeBytes,
      status: 'transcribing' as TranscriptStatus,
      transcription_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);

  // 4. Get pre-signed URL for Deepgram
  const audioUrl = await s3RecordingService.getTranscriptionUrl(s3Result.s3Key);

  // 5. Submit to Deepgram for transcription
  const transcriptionResult = await deepgramService.submitForTranscription(
    audioUrl,
    transcriptId!,
    {
      transcriptId: transcriptId!,
      organizationId: organizationId!,
      clientId: '', // Will be filled from transcript
      conciergeId: '', // Will be filled from transcript
      callSid: CallSid,
    }
  );

  if (!transcriptionResult.success) {
    // Update status to failed
    await supabase
      .from('call_transcripts')
      .update({
        status: 'failed' as TranscriptStatus,
        status_message: transcriptionResult.error || 'Failed to submit for transcription',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transcriptId);

    throw new Error(transcriptionResult.error || 'Failed to submit for transcription');
  }

  console.log(
    `[TwilioWebhook] Recording uploaded and submitted for transcription: ${transcriptId}`
  );

  // 6. Create audit log entry
  await supabase.from('transcript_audit_log').insert({
    transcript_id: transcriptId,
    action: 'recording_uploaded',
    performed_by: '00000000-0000-0000-0000-000000000000', // System
    details: {
      recording_sid: RecordingSid,
      s3_key: s3Result.s3Key,
      size_bytes: s3Result.sizeBytes,
      duration_seconds: RecordingDuration ? parseInt(RecordingDuration, 10) : null,
    },
  });
}

/**
 * Handle recording-failed event
 */
async function handleRecordingFailed(payload: TwilioRecordingWebhookPayload): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { CallSid, RecordingSid, RecordingErrorCode, TranscriptId } = payload;

  // Find transcript
  let transcriptId = TranscriptId;

  if (!transcriptId) {
    const { data: transcript } = await supabase
      .from('call_transcripts')
      .select('id')
      .eq('call_sid', CallSid)
      .single();

    transcriptId = transcript?.id;
  }

  if (!transcriptId) {
    console.warn(`[TwilioWebhook] No transcript found for failed recording ${CallSid}`);
    return;
  }

  // Update status to failed
  const { error } = await supabase
    .from('call_transcripts')
    .update({
      status: 'failed' as TranscriptStatus,
      status_message: `Recording failed: ${RecordingErrorCode || 'Unknown error'}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);

  if (error) {
    console.error(`[TwilioWebhook] Failed to update transcript ${transcriptId}:`, error);
    throw error;
  }

  // Create audit log entry
  await supabase.from('transcript_audit_log').insert({
    transcript_id: transcriptId,
    action: 'failed',
    performed_by: '00000000-0000-0000-0000-000000000000', // System
    details: {
      recording_sid: RecordingSid,
      error_code: RecordingErrorCode,
    },
  });

  console.log(`[TwilioWebhook] Recording failed for transcript ${transcriptId}`);
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleTwilioWebhook(req: Request, res: Response): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Get signature from headers
    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Missing Twilio signature' });
      return;
    }

    // 2. Build the full URL for verification
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    const url = `${protocol}://${host}${req.originalUrl}`;

    // 3. Get form-encoded body params
    const params = req.body as Record<string, string>;

    // 4. Verify signature
    if (!verifyTwilioSignature(signature, url, params)) {
      console.error('[TwilioWebhook] Invalid signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    // 5. Parse the payload
    const payload: TwilioRecordingWebhookPayload = {
      AccountSid: params.AccountSid,
      CallSid: params.CallSid,
      RecordingSid: params.RecordingSid,
      RecordingUrl: params.RecordingUrl,
      RecordingStatus: params.RecordingStatus as RecordingStatus,
      RecordingDuration: params.RecordingDuration,
      RecordingChannels: params.RecordingChannels,
      RecordingSource: params.RecordingSource as any,
      RecordingStartTime: params.RecordingStartTime,
      RecordingErrorCode: params.RecordingErrorCode,
      TranscriptId: params.TranscriptId,
      OrganizationId: params.OrganizationId,
    };

    console.log(`[TwilioWebhook] Received ${payload.RecordingStatus} for ${payload.CallSid}`);

    // 6. Handle different recording statuses
    try {
      switch (payload.RecordingStatus) {
        case 'in-progress':
          await handleRecordingStarted(payload);
          break;

        case 'completed':
          await handleRecordingCompleted(payload);
          break;

        case 'failed':
          await handleRecordingFailed(payload);
          break;

        default:
          console.log(`[TwilioWebhook] Unhandled status: ${payload.RecordingStatus}`);
      }
    } catch (handlerError: any) {
      console.error(`[TwilioWebhook] Handler error:`, handlerError);
      // Return 200 to acknowledge - Twilio will retry on non-2xx
    }

    // 7. Return success
    res.status(200).json({
      received: true,
      status: payload.RecordingStatus,
    });
  } catch (error: any) {
    console.error('[TwilioWebhook] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Export for Express router
export default handleTwilioWebhook;
