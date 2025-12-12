/**
 * Deepgram Transcription Webhook Handler
 *
 * Handles transcription completion callbacks from Deepgram:
 * - Parses transcription results
 * - Updates transcript with text and JSON
 * - Triggers AI summary generation
 *
 * Security:
 * - Validates transcriptId exists in database
 * - Optional HMAC signature verification if configured
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { deepgramService } from '../../services/deepgram/deepgramService';
import type { TranscriptStatus } from '../../services/callTranscription/types';

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
// Event Handlers
// ============================================================================

/**
 * Handle successful transcription
 */
async function handleTranscriptionCompleted(
  transcriptId: string,
  transcriptText: string,
  transcriptJson: any,
  duration: number,
  costCents: number
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // 1. Update transcript with results
  const { error } = await supabase
    .from('call_transcripts')
    .update({
      transcript_text: transcriptText,
      transcript_json: transcriptJson,
      transcription_completed_at: new Date().toISOString(),
      transcription_cost_cents: costCents,
      recording_duration_seconds: Math.round(duration),
      status: 'summarizing' as TranscriptStatus, // Move to summary generation
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);

  if (error) {
    console.error(`[DeepgramWebhook] Failed to update transcript ${transcriptId}:`, error);
    throw error;
  }

  // 2. Create audit log entry
  await supabase.from('transcript_audit_log').insert({
    transcript_id: transcriptId,
    action: 'transcription_completed',
    performed_by: '00000000-0000-0000-0000-000000000000', // System
    details: {
      duration_seconds: duration,
      cost_cents: costCents,
      word_count: transcriptJson?.words?.length || 0,
      utterance_count: transcriptJson?.utterances?.length || 0,
    },
  });

  console.log(`[DeepgramWebhook] Transcription completed for ${transcriptId}`);

  // 3. Trigger AI summary generation (async, don't block)
  // This will be handled by the CallTranscriptionService orchestrator
  // For now, we'll mark it as ready for summary generation
  // The frontend can poll for status or use real-time subscription

  // Option 1: Call summary generation endpoint
  // Option 2: Use event bus to trigger summary
  // Option 3: Frontend polls and requests summary when ready

  // For MVP, we'll move directly to 'ready' status
  // and let the concierge manually trigger summary if needed
  await supabase
    .from('call_transcripts')
    .update({
      status: 'ready' as TranscriptStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);
}

/**
 * Handle transcription failure
 */
async function handleTranscriptionFailed(
  transcriptId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // Update status to failed
  const { error } = await supabase
    .from('call_transcripts')
    .update({
      status: 'failed' as TranscriptStatus,
      status_message: `Transcription failed: ${errorMessage}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transcriptId);

  if (error) {
    console.error(`[DeepgramWebhook] Failed to update transcript ${transcriptId}:`, error);
    throw error;
  }

  // Create audit log entry
  await supabase.from('transcript_audit_log').insert({
    transcript_id: transcriptId,
    action: 'failed',
    performed_by: '00000000-0000-0000-0000-000000000000', // System
    details: {
      error: errorMessage,
      stage: 'transcription',
    },
  });

  console.log(`[DeepgramWebhook] Transcription failed for ${transcriptId}: ${errorMessage}`);
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleDeepgramWebhook(req: Request, res: Response): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Get transcriptId from query params or payload
    let transcriptId = req.query.transcriptId as string;

    // 2. Get the raw payload
    const payload = req.body;

    // 3. Verify signature if configured
    const signature = req.headers['x-deepgram-signature'] as string;
    const rawBody = JSON.stringify(payload);

    if (!deepgramService.verifyCallbackSignature(signature, rawBody)) {
      console.error('[DeepgramWebhook] Invalid signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    // 4. Parse the callback payload
    const result = deepgramService.parseCallbackPayload(payload);

    // Use transcriptId from payload if not in query
    if (!transcriptId && result.transcriptId) {
      transcriptId = result.transcriptId;
    }

    // 5. Validate transcriptId exists
    if (!transcriptId) {
      console.error('[DeepgramWebhook] No transcriptId in callback');
      res.status(400).json({ error: 'Missing transcriptId' });
      return;
    }

    // Verify transcript exists in database
    const supabase = getSupabaseServiceClient();
    const { data: transcript, error: lookupError } = await supabase
      .from('call_transcripts')
      .select('id, status')
      .eq('id', transcriptId)
      .single();

    if (lookupError || !transcript) {
      console.error(`[DeepgramWebhook] Transcript not found: ${transcriptId}`);
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    // 6. Handle success or failure
    try {
      if (result.success && result.transcriptJson && result.transcriptText !== undefined) {
        await handleTranscriptionCompleted(
          transcriptId,
          result.transcriptText,
          result.transcriptJson,
          result.duration || 0,
          result.costCents || 0
        );
      } else {
        await handleTranscriptionFailed(
          transcriptId,
          result.error || 'Unknown transcription error'
        );
      }
    } catch (handlerError: any) {
      console.error(`[DeepgramWebhook] Handler error:`, handlerError);
      // Return 200 to acknowledge - Deepgram may retry on non-2xx
    }

    // 7. Return success
    res.status(200).json({
      received: true,
      transcriptId,
      success: result.success,
    });
  } catch (error: any) {
    console.error('[DeepgramWebhook] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Export for Express router
export default handleDeepgramWebhook;
