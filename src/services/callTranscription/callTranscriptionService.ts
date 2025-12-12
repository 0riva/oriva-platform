/**
 * Call Transcription Service
 * High-level orchestrator for the transcription workflow
 *
 * Coordinates between:
 * - TwilioService: Recording management
 * - S3RecordingService: Audio storage
 * - DeepgramService: Speech-to-text
 * - Supabase: Database operations
 */

import { createClient } from '@supabase/supabase-js';
import { twilioService } from '../twilio/twilioService';
import { s3RecordingService } from '../s3/recordingService';
import { deepgramService } from '../deepgram/deepgramService';
import type {
  ConsentData,
  CallConsent,
  CallTranscript,
  TranscriptStatus,
  TranscriptFilters,
  TranscriptWithAudio,
  TranscriptListResponse,
  TranscriptSummaryStats,
  TranscriptServiceResponse,
  ConfirmTranscriptRequest,
  RejectTranscriptRequest,
  UseInMerlinRequest,
  ExtractedRequirements,
  DEFAULT_EXTRACTED_REQUIREMENTS,
  CreateAuditLogRequest,
  AuditAction,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.oriva.io';

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseClient(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = accessToken
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    : process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    db: { schema: 'travel_hub' },
  });
}

// ============================================================================
// Call Transcription Service Class
// ============================================================================

class CallTranscriptionService {
  /**
   * Record consent before starting a call recording
   * Required for GDPR/PCI-DSS compliance
   */
  async recordConsent(
    data: ConsentData,
    userId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<CallConsent>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { data: consent, error } = await supabase
        .from('call_consents')
        .insert({
          organization_id: data.organizationId,
          client_id: data.clientId,
          concierge_id: data.conciergeId,
          consent_method: data.consentMethod,
          consent_recorded_by: data.consentRecordedBy,
          call_type: data.callType,
          caller_number: data.callerNumber,
          callee_number: data.calleeNumber,
          call_direction: data.callDirection,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Map database response to type
      const result: CallConsent = {
        id: consent.id,
        organizationId: consent.organization_id,
        clientId: consent.client_id,
        conciergeId: consent.concierge_id,
        callSid: consent.call_sid,
        consentMethod: consent.consent_method,
        consentedAt: consent.consented_at,
        consentRecordedBy: consent.consent_recorded_by,
        callType: consent.call_type,
        callerNumber: consent.caller_number,
        calleeNumber: consent.callee_number,
        callDirection: consent.call_direction,
        createdAt: consent.created_at,
        updatedAt: consent.updated_at,
      };

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to record consent' };
    }
  }

  /**
   * Start recording a call via Twilio
   * Creates a transcript record and triggers Twilio recording
   */
  async startRecording(
    consentId: string,
    callSid: string,
    userId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<CallTranscript>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      // 1. Get consent to ensure it exists and get org/client info
      const { data: consent, error: consentError } = await supabase
        .from('call_consents')
        .select('*')
        .eq('id', consentId)
        .single();

      if (consentError || !consent) {
        return { success: false, error: 'Consent not found' };
      }

      // 2. Update consent with call_sid
      await supabase.from('call_consents').update({ call_sid: callSid }).eq('id', consentId);

      // 3. Create transcript record
      const { data: transcript, error: transcriptError } = await supabase
        .from('call_transcripts')
        .insert({
          organization_id: consent.organization_id,
          consent_id: consentId,
          client_id: consent.client_id,
          concierge_id: consent.concierge_id,
          call_sid: callSid,
          status: 'pending',
        })
        .select()
        .single();

      if (transcriptError || !transcript) {
        return { success: false, error: transcriptError?.message || 'Failed to create transcript' };
      }

      // 4. Start Twilio recording with webhook callback
      const webhookUrl = `${API_BASE_URL}/webhooks/twilio?TranscriptId=${transcript.id}&OrganizationId=${consent.organization_id}`;

      const twilioResult = await twilioService.startRecording({
        callSid,
        recordingChannels: 'dual',
        recordingStatusCallback: webhookUrl,
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['in-progress', 'completed', 'failed'],
        trim: 'trim-silence',
      });

      if (!twilioResult.success) {
        // Update transcript to failed status
        await supabase
          .from('call_transcripts')
          .update({
            status: 'failed',
            status_message: twilioResult.error,
          })
          .eq('id', transcript.id);

        return { success: false, error: twilioResult.error };
      }

      // 5. Update transcript with recording info
      await supabase
        .from('call_transcripts')
        .update({ status: 'recording' })
        .eq('id', transcript.id);

      // 6. Create audit log
      await this.createAuditLog({
        transcriptId: transcript.id,
        action: 'created',
        performedBy: userId,
        details: {
          consent_id: consentId,
          call_sid: callSid,
          recording_sid: twilioResult.data?.recordingSid,
        },
      });

      return {
        success: true,
        data: this.mapTranscriptFromDb(transcript),
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to start recording' };
    }
  }

  /**
   * Stop recording a call
   */
  async stopRecording(
    transcriptId: string,
    userId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<void>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      // Get transcript
      const { data: transcript, error } = await supabase
        .from('call_transcripts')
        .select('call_sid, status')
        .eq('id', transcriptId)
        .single();

      if (error || !transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      if (transcript.status !== 'recording') {
        return { success: false, error: 'Recording is not in progress' };
      }

      // Stop Twilio recording
      const result = await twilioService.stopRecording(transcript.call_sid);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to stop recording' };
    }
  }

  /**
   * Get transcripts with filtering and pagination
   */
  async getTranscripts(
    filters: TranscriptFilters,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<TranscriptListResponse>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      let query = supabase.from('call_transcripts').select('*', { count: 'exact' });

      // Apply filters
      if (filters.organizationId) {
        query = query.eq('organization_id', filters.organizationId);
      }
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.conciergeId) {
        query = query.eq('concierge_id', filters.conciergeId);
      }
      if (filters.itineraryId) {
        query = query.eq('itinerary_id', filters.itineraryId);
      }
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply pagination
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by created_at descending
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          transcripts: (data || []).map(this.mapTranscriptFromDb),
          total: count || 0,
          limit,
          offset,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to get transcripts' };
    }
  }

  /**
   * Get a single transcript with audio playback URL
   */
  async getTranscript(
    transcriptId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<TranscriptWithAudio>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { data: transcript, error } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();

      if (error || !transcript) {
        return { success: false, error: 'Transcript not found', statusCode: 404 };
      }

      const result: TranscriptWithAudio = this.mapTranscriptFromDb(transcript);

      // Get audio playback URL if recording exists
      if (transcript.recording_s3_key && !transcript.recording_deleted_at) {
        const playbackUrl = await s3RecordingService.getPlaybackUrl(transcript.recording_s3_key);
        result.audioPlaybackUrl = playbackUrl.url;
        result.audioUrlExpiresAt = playbackUrl.expiresAt;
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to get transcript' };
    }
  }

  /**
   * Confirm transcript accuracy and delete recording
   */
  async confirmTranscript(
    request: ConfirmTranscriptRequest,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<void>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { transcriptId, confirmedBy, deleteRecording = true } = request;

      // Get transcript
      const { data: transcript, error } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();

      if (error || !transcript) {
        return { success: false, error: 'Transcript not found', statusCode: 404 };
      }

      if (transcript.status !== 'ready') {
        return { success: false, error: 'Transcript is not ready for confirmation' };
      }

      // Update transcript
      const updateData: any = {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      };

      // Delete recording from S3 if requested (GDPR data minimization)
      if (deleteRecording && transcript.recording_s3_key) {
        try {
          await s3RecordingService.deleteRecording(transcript.recording_s3_key, confirmedBy);
          updateData.recording_deleted_at = new Date().toISOString();
          updateData.recording_deleted_by = confirmedBy;
          updateData.recording_url = null;
        } catch (s3Error: any) {
          console.warn('[CallTranscriptionService] Failed to delete S3 recording:', s3Error);
          // Continue with confirmation even if S3 delete fails
        }
      }

      await supabase.from('call_transcripts').update(updateData).eq('id', transcriptId);

      // Create audit log
      await this.createAuditLog({
        transcriptId,
        action: 'confirmed',
        performedBy: confirmedBy,
        details: { recording_deleted: deleteRecording },
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to confirm transcript' };
    }
  }

  /**
   * Reject transcript for re-review
   */
  async rejectTranscript(
    request: RejectTranscriptRequest,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<void>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { transcriptId, rejectedBy, reason } = request;

      // Get transcript
      const { data: transcript, error } = await supabase
        .from('call_transcripts')
        .select('status')
        .eq('id', transcriptId)
        .single();

      if (error || !transcript) {
        return { success: false, error: 'Transcript not found', statusCode: 404 };
      }

      if (transcript.status !== 'ready') {
        return { success: false, error: 'Transcript is not ready for rejection' };
      }

      // Update transcript
      await supabase
        .from('call_transcripts')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
          rejected_by: rejectedBy,
        })
        .eq('id', transcriptId);

      // Create audit log
      await this.createAuditLog({
        transcriptId,
        action: 'rejected',
        performedBy: rejectedBy,
        details: { reason },
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reject transcript' };
    }
  }

  /**
   * Get transcript summary stats for a client
   */
  async getClientTranscriptStats(
    clientId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<TranscriptSummaryStats>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { data, error } = await supabase.rpc('get_client_transcript_summary', {
        p_client_id: clientId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const stats: TranscriptSummaryStats = {
        totalCalls: data?.[0]?.total_calls || 0,
        confirmedCalls: data?.[0]?.confirmed_calls || 0,
        totalDurationMinutes: data?.[0]?.total_duration_minutes || 0,
        latestCallDate: data?.[0]?.latest_call_date,
      };

      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to get transcript stats' };
    }
  }

  /**
   * Get audio playback URL
   */
  async getAudioPlaybackUrl(
    transcriptId: string,
    accessToken?: string
  ): Promise<TranscriptServiceResponse<{ url: string; expiresAt: string }>> {
    const supabase = getSupabaseClient(accessToken);

    try {
      const { data: transcript, error } = await supabase
        .from('call_transcripts')
        .select('recording_s3_key, recording_deleted_at')
        .eq('id', transcriptId)
        .single();

      if (error || !transcript) {
        return { success: false, error: 'Transcript not found', statusCode: 404 };
      }

      if (!transcript.recording_s3_key) {
        return { success: false, error: 'No recording available' };
      }

      if (transcript.recording_deleted_at) {
        return { success: false, error: 'Recording has been deleted' };
      }

      const playbackUrl = await s3RecordingService.getPlaybackUrl(transcript.recording_s3_key);

      return {
        success: true,
        data: {
          url: playbackUrl.url,
          expiresAt: playbackUrl.expiresAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to get audio URL' };
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(request: CreateAuditLogRequest): Promise<void> {
    const supabase = getSupabaseClient();

    try {
      await supabase.from('transcript_audit_log').insert({
        transcript_id: request.transcriptId,
        action: request.action,
        performed_by: request.performedBy,
        details: request.details,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
      });
    } catch (error) {
      console.error('[CallTranscriptionService] Failed to create audit log:', error);
    }
  }

  /**
   * Map database record to CallTranscript type
   */
  private mapTranscriptFromDb(db: any): CallTranscript {
    return {
      id: db.id,
      organizationId: db.organization_id,
      consentId: db.consent_id,
      clientId: db.client_id,
      conciergeId: db.concierge_id,
      itineraryId: db.itinerary_id,
      callSid: db.call_sid,
      recordingUrl: db.recording_url,
      recordingS3Key: db.recording_s3_key,
      recordingDurationSeconds: db.recording_duration_seconds,
      recordingSizeBytes: db.recording_size_bytes,
      recordingFormat: db.recording_format || 'wav',
      transcriptText: db.transcript_text,
      transcriptJson: db.transcript_json,
      transcriptionProvider: db.transcription_provider || 'deepgram',
      transcriptionModel: db.transcription_model || 'nova-3',
      transcriptionLanguage: db.transcription_language || 'en',
      transcriptionCostCents: db.transcription_cost_cents,
      transcriptionStartedAt: db.transcription_started_at,
      transcriptionCompletedAt: db.transcription_completed_at,
      summaryText: db.summary_text,
      summaryModel: db.summary_model,
      extractedRequirements: db.extracted_requirements,
      status: db.status,
      statusMessage: db.status_message,
      confirmedAt: db.confirmed_at,
      confirmedBy: db.confirmed_by,
      rejectionReason: db.rejection_reason,
      rejectedAt: db.rejected_at,
      rejectedBy: db.rejected_by,
      recordingDeletedAt: db.recording_deleted_at,
      recordingDeletedBy: db.recording_deleted_by,
      merlinContextUsed: db.merlin_context_used || false,
      merlinConversationId: db.merlin_conversation_id,
      merlinContextInjectedAt: db.merlin_context_injected_at,
      totalCostCents: db.total_cost_cents,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const callTranscriptionService = new CallTranscriptionService();

export { CallTranscriptionService };
