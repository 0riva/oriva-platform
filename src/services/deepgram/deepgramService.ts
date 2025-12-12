/**
 * Deepgram Transcription Service
 * Manages speech-to-text transcription via Deepgram API
 *
 * Uses Nova-3 model with diarization for speaker identification
 * in Travel Hub Concierge call recordings.
 */

import { createClient, DeepgramClient, PrerecordedSchema } from '@deepgram/sdk';
import type {
  DeepgramConfig,
  TranscriptionOptions,
  DeepgramResponse,
  TranscriptJson,
  DeepgramServiceResponse,
  SubmitTranscriptionResponse,
  TranscriptionResultResponse,
  TranscriptionCostBreakdown,
  TranscriptionMetadata,
} from './deepgramTypes';
import { parseDeepgramResponse, calculateTranscriptionCost } from './deepgramTypes';

// ============================================================================
// Configuration
// ============================================================================

const config: DeepgramConfig = {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  callbackSecret: process.env.DEEPGRAM_CALLBACK_SECRET,
};

// Default transcription options optimized for call recordings
const DEFAULT_OPTIONS: TranscriptionOptions = {
  model: 'nova-3',
  language: 'en',
  punctuate: true,
  diarize: true,
  smartFormat: true,
  paragraphs: true,
  utterances: true,
};

// ============================================================================
// Deepgram Client Initialization
// ============================================================================

let deepgramClient: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!deepgramClient) {
    if (!config.apiKey) {
      throw new Error('Deepgram API key not configured. Set DEEPGRAM_API_KEY.');
    }
    deepgramClient = createClient(config.apiKey);
  }
  return deepgramClient;
}

// ============================================================================
// Deepgram Service Class
// ============================================================================

class DeepgramService {
  private client: DeepgramClient;
  private baseCallbackUrl: string;

  constructor() {
    this.client = getClient();
    // Callback URL for async transcription results
    this.baseCallbackUrl = process.env.API_BASE_URL
      ? `${process.env.API_BASE_URL}/webhooks/deepgram`
      : 'https://api.oriva.io/webhooks/deepgram';
  }

  /**
   * Submit audio URL for async transcription
   * Deepgram will call our webhook when complete
   *
   * @param audioUrl - Pre-signed S3 URL to the audio file
   * @param transcriptId - Our internal transcript ID (passed in callback)
   * @param options - Transcription options
   */
  async submitForTranscription(
    audioUrl: string,
    transcriptId: string,
    metadata: TranscriptionMetadata,
    options: TranscriptionOptions = {}
  ): Promise<DeepgramServiceResponse<SubmitTranscriptionResponse>> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      // Build Deepgram options
      const deepgramOptions: PrerecordedSchema = {
        model: mergedOptions.model || 'nova-3',
        language: mergedOptions.language || 'en',
        punctuate: mergedOptions.punctuate ?? true,
        diarize: mergedOptions.diarize ?? true,
        smart_format: mergedOptions.smartFormat ?? true,
        paragraphs: mergedOptions.paragraphs ?? true,
        utterances: mergedOptions.utterances ?? true,
        // Pass our transcript ID as a tag for the callback
        tag: [transcriptId],
        // Webhook callback for async processing
        callback: `${this.baseCallbackUrl}?transcriptId=${transcriptId}`,
        callback_method: 'post',
      };

      // Add optional features
      if (mergedOptions.summarize) {
        deepgramOptions.summarize = mergedOptions.summarize === 'v2' ? 'v2' : true;
      }
      if (mergedOptions.detectLanguage) {
        deepgramOptions.detect_language = true;
      }
      if (mergedOptions.detectEntities) {
        deepgramOptions.detect_entities = true;
      }
      if (mergedOptions.topics) {
        deepgramOptions.topics = true;
      }
      if (mergedOptions.intents) {
        deepgramOptions.intents = true;
      }
      if (mergedOptions.sentiment) {
        deepgramOptions.sentiment = true;
      }
      if (mergedOptions.keywords?.length) {
        deepgramOptions.keywords = mergedOptions.keywords;
      }
      if (mergedOptions.redact?.length) {
        deepgramOptions.redact = mergedOptions.redact;
      }

      // Submit for transcription (async with callback)
      const { result } = await this.client.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        deepgramOptions
      );

      // For async requests, result contains request_id
      const requestId = (result as any)?.request_id || transcriptId;

      console.log(
        `[DeepgramService] Submitted transcription: ${transcriptId} (request: ${requestId})`
      );

      return {
        success: true,
        data: {
          requestId,
          status: 'queued',
          callbackUrl: `${this.baseCallbackUrl}?transcriptId=${transcriptId}`,
        },
        requestId,
      };
    } catch (error: any) {
      console.error('[DeepgramService] Failed to submit transcription:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit transcription',
      };
    }
  }

  /**
   * Transcribe audio synchronously (blocking)
   * Use only for short recordings or when immediate result is needed
   */
  async transcribeSync(
    audioUrl: string,
    options: TranscriptionOptions = {}
  ): Promise<DeepgramServiceResponse<TranscriptionResultResponse>> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      const deepgramOptions: PrerecordedSchema = {
        model: mergedOptions.model || 'nova-3',
        language: mergedOptions.language || 'en',
        punctuate: mergedOptions.punctuate ?? true,
        diarize: mergedOptions.diarize ?? true,
        smart_format: mergedOptions.smartFormat ?? true,
        paragraphs: mergedOptions.paragraphs ?? true,
        utterances: mergedOptions.utterances ?? true,
      };

      if (mergedOptions.summarize) {
        deepgramOptions.summarize = mergedOptions.summarize === 'v2' ? 'v2' : true;
      }
      if (mergedOptions.redact?.length) {
        deepgramOptions.redact = mergedOptions.redact;
      }

      const { result } = await this.client.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        deepgramOptions
      );

      // Parse the response into our format
      const transcriptJson = parseDeepgramResponse(result as unknown as DeepgramResponse);

      // Get the plain text transcript
      const transcriptText =
        (result as any)?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      // Calculate cost
      const durationSeconds = (result as any)?.metadata?.duration || 0;
      const costBreakdown = calculateTranscriptionCost(durationSeconds, mergedOptions);

      return {
        success: true,
        data: {
          requestId: (result as any)?.metadata?.request_id || '',
          transcriptText,
          transcriptJson,
          duration: durationSeconds,
          costCents: costBreakdown.totalCents,
          model: mergedOptions.model || 'nova-3',
          language: transcriptJson.metadata.detected_language || mergedOptions.language || 'en',
        },
        requestId: (result as any)?.metadata?.request_id,
      };
    } catch (error: any) {
      console.error('[DeepgramService] Transcription failed:', error);
      return {
        success: false,
        error: error.message || 'Transcription failed',
      };
    }
  }

  /**
   * Parse Deepgram webhook callback payload
   */
  parseCallbackPayload(payload: any): {
    success: boolean;
    transcriptId?: string;
    transcriptJson?: TranscriptJson;
    transcriptText?: string;
    duration?: number;
    costCents?: number;
    error?: string;
  } {
    try {
      // Extract transcript ID from tag
      const transcriptId = payload.tag || payload.metadata?.tag;

      if (!payload.results) {
        return {
          success: false,
          transcriptId,
          error: payload.err_msg || 'No results in callback',
        };
      }

      // Parse to our format
      const transcriptJson = parseDeepgramResponse(payload as DeepgramResponse);

      // Get plain text
      const transcriptText = payload.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      // Calculate cost
      const durationSeconds = payload.metadata?.duration || 0;
      const costBreakdown = calculateTranscriptionCost(durationSeconds, DEFAULT_OPTIONS);

      return {
        success: true,
        transcriptId,
        transcriptJson,
        transcriptText,
        duration: durationSeconds,
        costCents: costBreakdown.totalCents,
      };
    } catch (error: any) {
      console.error('[DeepgramService] Failed to parse callback:', error);
      return {
        success: false,
        error: error.message || 'Failed to parse callback payload',
      };
    }
  }

  /**
   * Verify Deepgram callback signature (if implemented)
   * Note: Deepgram doesn't have built-in webhook signing,
   * so we rely on the transcriptId parameter validation
   */
  verifyCallbackSignature(signature: string | undefined, payload: string): boolean {
    if (!config.callbackSecret) {
      // No secret configured, accept all callbacks
      // In production, validate transcriptId exists in database
      return true;
    }

    // If we implement HMAC verification:
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', config.callbackSecret)
    //   .update(payload)
    //   .digest('hex');
    // return signature === expectedSignature;

    return true;
  }

  /**
   * Calculate estimated transcription cost
   */
  calculateCost(
    durationSeconds: number,
    options: TranscriptionOptions = {}
  ): TranscriptionCostBreakdown {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    return calculateTranscriptionCost(durationSeconds, mergedOptions);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return ['en', 'en-US', 'en-GB', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'zh', 'multi'];
  }

  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return ['nova-3', 'nova-2', 'nova', 'enhanced', 'base'];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const deepgramService = new DeepgramService();

export { DeepgramService };
