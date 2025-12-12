/**
 * Deepgram Transcription API Type Definitions
 * For speech-to-text in Travel Hub Concierge
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface DeepgramConfig {
  apiKey: string;
  callbackSecret?: string;
}

// ============================================================================
// Transcription Options
// ============================================================================

export type DeepgramModel =
  | 'nova-3' // Highest accuracy, recommended
  | 'nova-2' // High accuracy
  | 'nova' // Standard
  | 'enhanced' // Enhanced accuracy
  | 'base'; // Basic, fastest

export type DeepgramLanguage =
  | 'en' // English (default)
  | 'en-US' // US English
  | 'en-GB' // British English
  | 'es' // Spanish
  | 'fr' // French
  | 'de' // German
  | 'it' // Italian
  | 'pt' // Portuguese
  | 'nl' // Dutch
  | 'ja' // Japanese
  | 'zh' // Chinese
  | 'multi'; // Auto-detect (multilingual)

export interface TranscriptionOptions {
  model?: DeepgramModel;
  language?: DeepgramLanguage;
  punctuate?: boolean; // Add punctuation
  profanityFilter?: boolean; // Filter profanity
  redact?: RedactionType[]; // Redact sensitive info
  diarize?: boolean; // Speaker identification
  diarizeVersion?: string; // Diarization version
  smartFormat?: boolean; // Smart formatting
  paragraphs?: boolean; // Group into paragraphs
  utterances?: boolean; // Split by speaker
  detectLanguage?: boolean; // Auto-detect language
  detectEntities?: boolean; // Named entity recognition
  summarize?: boolean | 'v2'; // Auto-summarization
  topics?: boolean; // Topic detection
  intents?: boolean; // Intent detection
  sentiment?: boolean; // Sentiment analysis
  keywords?: string[]; // Boost specific keywords
  callback?: string; // Webhook callback URL
  callbackMethod?: 'POST' | 'PUT';
  tag?: string; // Custom tag for tracking
}

export type RedactionType =
  | 'pci' // Credit card numbers
  | 'ssn' // Social Security numbers
  | 'numbers' // All numbers
  | 'true'; // Default redaction

// ============================================================================
// Transcription Request Types
// ============================================================================

export interface PrerecordedTranscriptionRequest {
  url: string; // URL to audio file
  options: TranscriptionOptions;
  metadata?: TranscriptionMetadata;
}

export interface TranscriptionMetadata {
  transcriptId: string; // Our internal transcript ID
  organizationId: string;
  clientId: string;
  conciergeId: string;
  callSid?: string;
}

// ============================================================================
// Transcription Response Types
// ============================================================================

export interface DeepgramResponse {
  request_id: string;
  metadata: DeepgramMetadata;
  results: DeepgramResults;
}

export interface DeepgramMetadata {
  request_id: string;
  transaction_key: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
  models: string[];
  model_info: Record<string, ModelInfo>;
}

export interface ModelInfo {
  name: string;
  version: string;
  arch: string;
}

export interface DeepgramResults {
  channels: DeepgramChannel[];
  utterances?: DeepgramUtterance[];
  summary?: DeepgramSummary;
  topics?: DeepgramTopic[];
  intents?: DeepgramIntent[];
  sentiments?: DeepgramSentiment[];
}

export interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
  detected_language?: string;
  language_confidence?: number;
}

export interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
  paragraphs?: DeepgramParagraph;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  speaker_confidence?: number;
  punctuated_word?: string;
}

export interface DeepgramParagraph {
  transcript: string;
  paragraphs: ParagraphItem[];
}

export interface ParagraphItem {
  sentences: SentenceItem[];
  speaker?: number;
  start: number;
  end: number;
  num_words: number;
}

export interface SentenceItem {
  text: string;
  start: number;
  end: number;
}

export interface DeepgramUtterance {
  id: string;
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker?: number;
}

export interface DeepgramSummary {
  result: 'success' | 'error';
  short: string;
  long?: string;
}

export interface DeepgramTopic {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DeepgramIntent {
  intent: string;
  confidence: number;
}

export interface DeepgramSentiment {
  text: string;
  start: number;
  end: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
}

// ============================================================================
// Our Internal Transcript JSON Format
// (Stored in call_transcripts.transcript_json)
// ============================================================================

export interface TranscriptJson {
  words: TranscriptWord[];
  utterances: TranscriptUtterance[];
  speakers: Record<string, 'agent' | 'client' | 'unknown'>;
  metadata: TranscriptJsonMetadata;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number;
  punctuated_word?: string;
}

export interface TranscriptUtterance {
  id: string;
  speaker: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptJsonMetadata {
  model: string;
  language: string;
  duration: number;
  channels: number;
  created: string;
  request_id: string;
  detected_language?: string;
  summary?: string;
  topics?: string[];
}

// ============================================================================
// Webhook Callback Types
// ============================================================================

export interface DeepgramWebhookPayload {
  request_id: string;
  metadata: DeepgramMetadata;
  results: DeepgramResults;
  // Custom metadata we pass via callback
  tag?: string; // Contains our transcriptId
}

export interface DeepgramCallbackResult {
  success: boolean;
  transcriptId: string;
  transcript: TranscriptJson;
  summary?: string;
  error?: string;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface DeepgramServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

export interface SubmitTranscriptionResponse {
  requestId: string;
  status: 'queued' | 'processing';
  estimatedDuration?: number;
  callbackUrl: string;
}

export interface TranscriptionResultResponse {
  requestId: string;
  transcriptText: string;
  transcriptJson: TranscriptJson;
  duration: number;
  costCents: number;
  model: string;
  language: string;
}

// ============================================================================
// Cost Calculation Types
// ============================================================================

export interface TranscriptionCostBreakdown {
  baseCost: number; // Nova-3 base cost
  diarizationCost: number; // Speaker identification
  redactionCost: number; // PCI/SSN redaction
  summarizationCost: number; // Auto-summarization
  totalCents: number;
}

// Deepgram pricing per minute (as of 2024)
export const DEEPGRAM_PRICING = {
  'nova-3': 0.0043, // $0.0043/min
  'nova-2': 0.0036, // $0.0036/min
  nova: 0.0025, // $0.0025/min
  enhanced: 0.0145, // $0.0145/min
  base: 0.0125, // $0.0125/min
  diarization: 0.0017, // $0.0017/min additional
  redaction: 0.0017, // $0.0017/min additional
  summarization: 0.01, // $0.01/min additional (estimated)
} as const;

// ============================================================================
// Error Types
// ============================================================================

export interface DeepgramError {
  err_code: string;
  err_msg: string;
  request_id?: string;
}

export const DEEPGRAM_ERROR_CODES = {
  INVALID_AUDIO: 'INVALID_AUDIO',
  AUDIO_TOO_LONG: 'AUDIO_TOO_LONG',
  AUDIO_TOO_SHORT: 'AUDIO_TOO_SHORT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  RATE_LIMITED: 'RATE_LIMITED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  CALLBACK_FAILED: 'CALLBACK_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Deepgram response to our internal TranscriptJson format
 */
export function parseDeepgramResponse(response: DeepgramResponse): TranscriptJson {
  const channel = response.results.channels[0];
  const alternative = channel?.alternatives[0];

  if (!alternative) {
    throw new Error('No transcription results found');
  }

  // Build words array
  const words: TranscriptWord[] = alternative.words.map((w) => ({
    word: w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
    speaker: w.speaker ?? 0,
    punctuated_word: w.punctuated_word,
  }));

  // Build utterances array
  const utterances: TranscriptUtterance[] = (response.results.utterances || []).map((u, idx) => ({
    id: u.id || `utt_${idx}`,
    speaker: u.speaker ?? 0,
    text: u.transcript,
    start: u.start,
    end: u.end,
    confidence: u.confidence,
  }));

  // Default speaker mapping (can be updated by agent later)
  const speakers: Record<string, 'agent' | 'client' | 'unknown'> = {
    '0': 'agent',
    '1': 'client',
  };

  // Build metadata
  const metadata: TranscriptJsonMetadata = {
    model: response.metadata.models[0] || 'nova-3',
    language: channel.detected_language || 'en',
    duration: response.metadata.duration,
    channels: response.metadata.channels,
    created: response.metadata.created,
    request_id: response.metadata.request_id,
    detected_language: channel.detected_language,
    summary: response.results.summary?.short,
    topics: response.results.topics?.map((t) => t.text),
  };

  return {
    words,
    utterances,
    speakers,
    metadata,
  };
}

/**
 * Calculate transcription cost in cents
 */
export function calculateTranscriptionCost(
  durationSeconds: number,
  options: TranscriptionOptions
): TranscriptionCostBreakdown {
  const durationMinutes = durationSeconds / 60;
  const model = options.model || 'nova-3';

  const baseCost = durationMinutes * (DEEPGRAM_PRICING[model] || DEEPGRAM_PRICING['nova-3']);
  const diarizationCost = options.diarize ? durationMinutes * DEEPGRAM_PRICING.diarization : 0;
  const redactionCost = options.redact?.length ? durationMinutes * DEEPGRAM_PRICING.redaction : 0;
  const summarizationCost = options.summarize
    ? durationMinutes * DEEPGRAM_PRICING.summarization
    : 0;

  const totalDollars = baseCost + diarizationCost + redactionCost + summarizationCost;
  const totalCents = Math.ceil(totalDollars * 100);

  return {
    baseCost: Math.ceil(baseCost * 100),
    diarizationCost: Math.ceil(diarizationCost * 100),
    redactionCost: Math.ceil(redactionCost * 100),
    summarizationCost: Math.ceil(summarizationCost * 100),
    totalCents,
  };
}
