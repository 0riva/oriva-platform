/**
 * Twilio Voice API Type Definitions
 * For call recording management in Travel Hub Concierge
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  webhookSecret?: string;
}

// ============================================================================
// Call Types
// ============================================================================

export type CallDirection = 'inbound' | 'outbound';
export type CallType = 'pstn' | 'whatsapp' | 'voip' | 'in_app';
export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

export interface TwilioCall {
  sid: string;
  accountSid: string;
  to: string;
  from: string;
  status: CallStatus;
  direction: CallDirection;
  duration?: number;
  startTime?: string;
  endTime?: string;
  price?: string;
  priceUnit?: string;
}

// ============================================================================
// Recording Types
// ============================================================================

export type RecordingStatus =
  | 'in-progress'
  | 'paused'
  | 'stopped'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'absent';

export type RecordingChannel = 'mono' | 'dual';
export type RecordingSource =
  | 'DialVerb'
  | 'Conference'
  | 'OutboundAPI'
  | 'Trunking'
  | 'RecordVerb'
  | 'StartCallRecordingAPI';

export interface TwilioRecording {
  sid: string;
  accountSid: string;
  callSid: string;
  conferenceSid?: string;
  status: RecordingStatus;
  channels: number;
  source: RecordingSource;
  duration?: number;
  startTime?: string;
  price?: string;
  priceUnit?: string;
  uri: string;
  mediaUrl?: string;
  errorCode?: number;
}

export interface RecordingStartOptions {
  callSid: string;
  recordingChannels?: RecordingChannel;
  recordingStatusCallback?: string;
  recordingStatusCallbackMethod?: 'GET' | 'POST';
  recordingStatusCallbackEvent?: RecordingStatusCallbackEvent[];
  trim?: 'trim-silence' | 'do-not-trim';
}

export type RecordingStatusCallbackEvent =
  | 'in-progress'
  | 'completed'
  | 'absent'
  | 'paused'
  | 'resumed'
  | 'failed';

export interface RecordingResult {
  recordingSid: string;
  callSid: string;
  status: RecordingStatus;
  channels: number;
  startTime: string;
}

export interface RecordingStopResult {
  recordingSid: string;
  callSid: string;
  status: RecordingStatus;
  duration: number;
  uri: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type TwilioWebhookEventType =
  | 'recording-started'
  | 'recording-completed'
  | 'recording-failed'
  | 'recording-paused'
  | 'recording-resumed'
  | 'call-initiated'
  | 'call-ringing'
  | 'call-answered'
  | 'call-completed';

export interface TwilioRecordingWebhookPayload {
  AccountSid: string;
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: RecordingStatus;
  RecordingDuration?: string;
  RecordingChannels?: string;
  RecordingSource?: RecordingSource;
  RecordingStartTime?: string;
  RecordingErrorCode?: string;
  // Custom parameters we set
  TranscriptId?: string;
  OrganizationId?: string;
}

export interface TwilioCallWebhookPayload {
  AccountSid: string;
  CallSid: string;
  CallStatus: CallStatus;
  Direction: CallDirection;
  From: string;
  To: string;
  Duration?: string;
  CallDuration?: string;
  Timestamp?: string;
  // Custom parameters
  TranscriptId?: string;
  OrganizationId?: string;
}

export interface TwilioWebhookValidationResult {
  isValid: boolean;
  payload?: TwilioRecordingWebhookPayload | TwilioCallWebhookPayload;
  error?: string;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface TwilioServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface StartRecordingResponse {
  recordingSid: string;
  callSid: string;
  status: RecordingStatus;
  message: string;
}

export interface StopRecordingResponse {
  recordingSid: string;
  callSid: string;
  duration: number;
  recordingUrl: string;
  status: RecordingStatus;
}

export interface GetRecordingResponse {
  recording: TwilioRecording;
  downloadUrl: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface TwilioError {
  code: number;
  message: string;
  moreInfo?: string;
  status?: number;
}

export const TWILIO_ERROR_CODES = {
  CALL_NOT_FOUND: 20404,
  RECORDING_NOT_FOUND: 20404,
  INVALID_CALL_STATE: 21220,
  RECORDING_ALREADY_EXISTS: 21208,
  INSUFFICIENT_PERMISSIONS: 20003,
  INVALID_REQUEST: 21100,
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export interface RecordingMetadata {
  callSid: string;
  recordingSid: string;
  organizationId: string;
  transcriptId: string;
  duration: number;
  channels: number;
  source: RecordingSource;
  startTime: string;
  endTime?: string;
}

export interface RecordingDownloadOptions {
  format?: 'wav' | 'mp3';
  includeAuth?: boolean;
}
