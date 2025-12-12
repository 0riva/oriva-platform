/**
 * Call Transcription Service Types
 * Shared types for the transcription workflow orchestration
 */

import type { CallType, CallDirection, RecordingStatus } from '../twilio/twilioTypes';
import type { TranscriptJson, TranscriptionOptions } from '../deepgram/deepgramTypes';

// ============================================================================
// Consent Types
// ============================================================================

export type ConsentMethod = 'verbal' | 'written' | 'electronic' | 'implied';

export interface ConsentData {
  organizationId: string;
  clientId: string;
  conciergeId: string;
  consentMethod: ConsentMethod;
  consentRecordedBy: string; // auth.users.id
  callType: CallType;
  callerNumber?: string;
  calleeNumber?: string;
  callDirection?: CallDirection;
}

export interface CallConsent {
  id: string;
  organizationId: string;
  clientId: string;
  conciergeId: string;
  callSid?: string;
  consentMethod: ConsentMethod;
  consentedAt: string;
  consentRecordedBy: string;
  callType: CallType;
  callerNumber?: string;
  calleeNumber?: string;
  callDirection?: CallDirection;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Transcript Status Types
// ============================================================================

export type TranscriptStatus =
  | 'pending' // Waiting for recording
  | 'recording' // Call in progress, recording
  | 'processing' // Recording received, uploading to S3
  | 'transcribing' // Deepgram processing
  | 'summarizing' // AI generating summary
  | 'ready' // Ready for agent review
  | 'confirmed' // Agent confirmed accuracy
  | 'rejected' // Agent rejected, needs review
  | 'archived' // Soft deleted
  | 'failed'; // Processing failed

// ============================================================================
// Transcript Types
// ============================================================================

export interface CallTranscript {
  id: string;
  organizationId: string;
  consentId: string;
  clientId: string;
  conciergeId: string;
  itineraryId?: string;

  // Recording details
  callSid: string;
  recordingUrl?: string;
  recordingS3Key?: string;
  recordingDurationSeconds?: number;
  recordingSizeBytes?: number;
  recordingFormat: string;

  // Transcription details
  transcriptText?: string;
  transcriptJson?: TranscriptJson;
  transcriptionProvider: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  transcriptionCostCents?: number;
  transcriptionStartedAt?: string;
  transcriptionCompletedAt?: string;

  // AI Summary
  summaryText?: string;
  summaryModel?: string;

  // Extracted requirements
  extractedRequirements?: ExtractedRequirements;

  // Status tracking
  status: TranscriptStatus;
  statusMessage?: string;

  // Confirmation workflow
  confirmedAt?: string;
  confirmedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;

  // Recording deletion
  recordingDeletedAt?: string;
  recordingDeletedBy?: string;

  // Merlin AI integration
  merlinContextUsed: boolean;
  merlinConversationId?: string;
  merlinContextInjectedAt?: string;

  // Cost tracking
  totalCostCents?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Extracted Requirements Types
// (AI-parsed travel requirements from transcript)
// ============================================================================

export interface ExtractedRequirements {
  destinations: string[];
  dates: TravelDates;
  budget: TravelBudget;
  travelers: TravelerInfo;
  preferences: TravelPreferences;
  constraints: TravelConstraints;
  logistics: TravelLogistics;
  specialOccasions: SpecialOccasion[];
  confidenceScore: number;
}

export interface TravelDates {
  flexible: boolean;
  preferredStart?: string;
  preferredEnd?: string;
  durationDays?: number;
  notes?: string;
}

export interface TravelBudget {
  amount?: number;
  currency: string;
  perPerson: boolean;
  flexibility?: 'strict' | 'moderate' | 'flexible';
  notes?: string;
}

export interface TravelerInfo {
  count: number;
  adults: number;
  children: number;
  types: TravelerType[];
  specialNeeds: string[];
  ages?: number[];
}

export type TravelerType = 'solo' | 'couple' | 'family' | 'group' | 'business' | 'honeymoon';

export interface TravelPreferences {
  accommodation: string[];
  experiences: string[];
  pace: 'relaxed' | 'moderate' | 'active';
  mustDos: string[];
  interests: string[];
  style: 'budget' | 'mid-range' | 'luxury' | 'ultra-luxury';
}

export interface TravelConstraints {
  dietary: string[];
  mobility?: string;
  allergies: string[];
  avoiding: string[];
}

export interface TravelLogistics {
  departureCity?: string;
  preferredAirlines: string[];
  seatPreference?: 'window' | 'aisle' | 'middle';
  class: 'economy' | 'premium-economy' | 'business' | 'first';
}

export interface SpecialOccasion {
  type: string;
  date?: string;
  notes?: string;
}

// ============================================================================
// Service Request Types
// ============================================================================

export interface StartRecordingRequest {
  consentId: string;
  callSid: string;
  callType: CallType;
}

export interface StopRecordingRequest {
  transcriptId: string;
}

export interface TranscriptFilters {
  organizationId?: string;
  clientId?: string;
  conciergeId?: string;
  itineraryId?: string;
  status?: TranscriptStatus | TranscriptStatus[];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ConfirmTranscriptRequest {
  transcriptId: string;
  confirmedBy: string;
  deleteRecording?: boolean; // Default: true
  notes?: string;
  extractedRequirements?: ExtractedRequirements;
}

export interface RejectTranscriptRequest {
  transcriptId: string;
  rejectedBy: string;
  reason: string;
  requestRetranscription?: boolean;
}

export interface UseInMerlinRequest {
  transcriptId: string;
  conversationId?: string; // Existing Merlin conversation
  createNewConversation?: boolean;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface TranscriptServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface TranscriptWithAudio extends CallTranscript {
  audioPlaybackUrl?: string;
  audioUrlExpiresAt?: string;
}

export interface TranscriptListResponse {
  transcripts: CallTranscript[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranscriptSummaryStats {
  totalCalls: number;
  confirmedCalls: number;
  totalDurationMinutes: number;
  latestCallDate?: string;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export type AuditAction =
  | 'created'
  | 'recording_uploaded'
  | 'transcription_started'
  | 'transcription_completed'
  | 'summary_generated'
  | 'reviewed'
  | 'confirmed'
  | 'rejected'
  | 'recording_deleted'
  | 'exported_to_merlin'
  | 'archived'
  | 'restored'
  | 'failed';

export interface TranscriptAuditLog {
  id: string;
  transcriptId: string;
  action: AuditAction;
  performedBy: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CreateAuditLogRequest {
  transcriptId: string;
  action: AuditAction;
  performedBy: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// S3 Recording Types
// ============================================================================

export interface S3RecordingUpload {
  organizationId: string;
  callSid: string;
  transcriptId: string;
  sourceUrl: string; // Twilio recording URL
}

export interface S3UploadResult {
  s3Key: string;
  s3Bucket: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
}

export interface S3PlaybackUrl {
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface S3DeletionResult {
  s3Key: string;
  deletedAt: string;
  deletedBy: string;
}

// ============================================================================
// Workflow Event Types
// ============================================================================

export type TranscriptionWorkflowEvent =
  | 'consent_recorded'
  | 'recording_started'
  | 'recording_stopped'
  | 'recording_uploaded'
  | 'transcription_submitted'
  | 'transcription_completed'
  | 'summary_generated'
  | 'transcript_confirmed'
  | 'transcript_rejected'
  | 'recording_deleted'
  | 'merlin_context_injected'
  | 'error_occurred';

export interface WorkflowEventPayload {
  event: TranscriptionWorkflowEvent;
  transcriptId: string;
  organizationId: string;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Merlin Integration Types
// ============================================================================

export interface MerlinContextData {
  transcriptId: string;
  transcriptSummary: string;
  extractedRequirements: ExtractedRequirements;
  clientName?: string;
  conciergeName?: string;
  callDate: string;
  callDuration?: number;
}

export interface MerlinInjectionResult {
  success: boolean;
  conversationId: string;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_TRANSCRIPTION_OPTIONS: TranscriptionOptions = {
  model: 'nova-3',
  language: 'en',
  punctuate: true,
  diarize: true,
  smartFormat: true,
  utterances: true,
  paragraphs: true,
};

export const DEFAULT_EXTRACTED_REQUIREMENTS: ExtractedRequirements = {
  destinations: [],
  dates: {
    flexible: true,
  },
  budget: {
    currency: 'USD',
    perPerson: false,
  },
  travelers: {
    count: 1,
    adults: 1,
    children: 0,
    types: [],
    specialNeeds: [],
  },
  preferences: {
    accommodation: [],
    experiences: [],
    pace: 'moderate',
    mustDos: [],
    interests: [],
    style: 'mid-range',
  },
  constraints: {
    dietary: [],
    allergies: [],
    avoiding: [],
  },
  logistics: {
    preferredAirlines: [],
    class: 'economy',
  },
  specialOccasions: [],
  confidenceScore: 0,
};
