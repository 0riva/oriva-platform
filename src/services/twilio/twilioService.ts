/**
 * Twilio Voice Service
 * Manages call recording via Twilio Voice API
 *
 * Used by Travel Hub Concierge for recording client calls
 * after verbal consent is obtained.
 */

import Twilio from 'twilio';
import type {
  TwilioConfig,
  TwilioRecording,
  RecordingStatus,
  RecordingSource,
  RecordingStartOptions,
  RecordingResult,
  RecordingStopResult,
  TwilioServiceResponse,
  StartRecordingResponse,
  StopRecordingResponse,
  GetRecordingResponse,
  RecordingDownloadOptions,
  RecordingMetadata,
} from './twilioTypes';

// ============================================================================
// Configuration
// ============================================================================

const config: TwilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  webhookSecret: process.env.TWILIO_WEBHOOK_SECRET,
};

// ============================================================================
// Twilio Client Initialization
// ============================================================================

let twilioClient: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio {
  if (!twilioClient) {
    if (!config.accountSid || !config.authToken) {
      throw new Error(
        'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
      );
    }
    twilioClient = Twilio(config.accountSid, config.authToken);
  }
  return twilioClient;
}

// ============================================================================
// Twilio Service Class
// ============================================================================

class TwilioService {
  private _client: Twilio.Twilio | null = null;

  private get client(): Twilio.Twilio {
    if (!this._client) {
      this._client = getClient();
    }
    return this._client;
  }

  constructor() {
    // Lazy initialization - client is created on first use
  }

  /**
   * Start recording on an active call
   *
   * @param options - Recording start options including callSid and webhook URLs
   * @returns Recording result with SID and status
   */
  async startRecording(
    options: RecordingStartOptions
  ): Promise<TwilioServiceResponse<StartRecordingResponse>> {
    const {
      callSid,
      recordingChannels = 'dual', // Dual for speaker diarization
      recordingStatusCallback,
      recordingStatusCallbackMethod = 'POST',
      recordingStatusCallbackEvent = ['completed', 'failed'],
      trim = 'trim-silence',
    } = options;

    try {
      const recording = await this.client.calls(callSid).recordings.create({
        recordingChannels,
        recordingStatusCallback,
        recordingStatusCallbackMethod,
        recordingStatusCallbackEvent,
        trim,
      });

      return {
        success: true,
        data: {
          recordingSid: recording.sid,
          callSid: recording.callSid,
          status: recording.status as RecordingStatus,
          message: 'Recording started successfully',
        },
      };
    } catch (error: any) {
      console.error('[TwilioService] Failed to start recording:', error);
      return {
        success: false,
        error: error.message || 'Failed to start recording',
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * Stop recording on a call
   *
   * @param callSid - The call SID to stop recording
   * @param recordingSid - Optional specific recording SID to stop
   */
  async stopRecording(
    callSid: string,
    recordingSid?: string
  ): Promise<TwilioServiceResponse<StopRecordingResponse>> {
    try {
      let recording;

      if (recordingSid) {
        // Stop specific recording
        recording = await this.client
          .calls(callSid)
          .recordings(recordingSid)
          .update({ status: 'stopped' });
      } else {
        // Find and stop active recording
        const allRecordings = await this.client.calls(callSid).recordings.list();
        const activeRecordings = allRecordings.filter((r) => r.status === 'in-progress');

        if (activeRecordings.length === 0) {
          return {
            success: false,
            error: 'No active recording found for this call',
          };
        }

        recording = await this.client
          .calls(callSid)
          .recordings(activeRecordings[0].sid)
          .update({ status: 'stopped' });
      }

      // Generate the recording URL
      const recordingUrl = this.getRecordingUrl(recording.sid);

      return {
        success: true,
        data: {
          recordingSid: recording.sid,
          callSid: recording.callSid,
          duration: recording.duration ? parseInt(recording.duration, 10) : 0,
          recordingUrl,
          status: recording.status as RecordingStatus,
        },
      };
    } catch (error: any) {
      console.error('[TwilioService] Failed to stop recording:', error);
      return {
        success: false,
        error: error.message || 'Failed to stop recording',
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * Get recording details by SID
   */
  async getRecording(recordingSid: string): Promise<TwilioServiceResponse<GetRecordingResponse>> {
    try {
      const recording = await this.client.recordings(recordingSid).fetch();

      const twilioRecording: TwilioRecording = {
        sid: recording.sid,
        accountSid: recording.accountSid,
        callSid: recording.callSid,
        status: recording.status as RecordingStatus,
        channels: recording.channels ?? 1,
        source: recording.source as RecordingSource,
        duration: recording.duration ? parseInt(recording.duration, 10) : undefined,
        startTime: recording.startTime?.toISOString(),
        price: recording.price ? String(recording.price) : undefined,
        priceUnit: recording.priceUnit || undefined,
        uri: recording.uri,
        mediaUrl: this.getRecordingUrl(recording.sid),
      };

      return {
        success: true,
        data: {
          recording: twilioRecording,
          downloadUrl: this.getRecordingUrl(recording.sid, { format: 'wav', includeAuth: true }),
        },
      };
    } catch (error: any) {
      console.error('[TwilioService] Failed to get recording:', error);
      return {
        success: false,
        error: error.message || 'Failed to get recording',
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * Generate recording URL (with optional auth for downloading)
   */
  getRecordingUrl(recordingSid: string, options: RecordingDownloadOptions = {}): string {
    const { format = 'wav', includeAuth = false } = options;

    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${recordingSid}.${format}`;

    if (includeAuth) {
      // Return URL with embedded credentials (use only server-side)
      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      return `${baseUrl}?Authorization=Basic%20${auth}`;
    }

    return baseUrl;
  }

  /**
   * Delete recording from Twilio (after S3 upload)
   */
  async deleteRecording(recordingSid: string): Promise<TwilioServiceResponse<void>> {
    try {
      await this.client.recordings(recordingSid).remove();

      console.log(`[TwilioService] Deleted recording: ${recordingSid}`);

      return { success: true };
    } catch (error: any) {
      console.error('[TwilioService] Failed to delete recording:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete recording',
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * List recordings for a call
   */
  async listRecordingsForCall(callSid: string): Promise<TwilioServiceResponse<TwilioRecording[]>> {
    try {
      const recordings = await this.client.calls(callSid).recordings.list();

      const result: TwilioRecording[] = recordings.map((r) => ({
        sid: r.sid,
        accountSid: r.accountSid,
        callSid: r.callSid,
        status: r.status as RecordingStatus,
        channels: r.channels ?? 1,
        source: r.source as RecordingSource,
        duration: r.duration ? parseInt(r.duration, 10) : undefined,
        startTime: r.startTime?.toISOString(),
        price: r.price ? String(r.price) : undefined,
        priceUnit: r.priceUnit || undefined,
        uri: r.uri,
        mediaUrl: this.getRecordingUrl(r.sid),
      }));

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error('[TwilioService] Failed to list recordings:', error);
      return {
        success: false,
        error: error.message || 'Failed to list recordings',
        errorCode: error.code?.toString(),
      };
    }
  }

  /**
   * Verify Twilio webhook signature
   */
  static verifyWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!config.webhookSecret) {
      console.warn(
        '[TwilioService] Webhook secret not configured, skipping signature verification'
      );
      return true;
    }

    return Twilio.validateRequest(config.authToken, signature, url, params);
  }

  /**
   * Get call details
   */
  async getCall(callSid: string): Promise<
    TwilioServiceResponse<{
      sid: string;
      status: string;
      direction: string;
      from: string;
      to: string;
      duration?: number;
      startTime?: string;
      endTime?: string;
    }>
  > {
    try {
      const call = await this.client.calls(callSid).fetch();

      return {
        success: true,
        data: {
          sid: call.sid,
          status: call.status,
          direction: call.direction,
          from: call.from,
          to: call.to,
          duration: call.duration ? parseInt(call.duration, 10) : undefined,
          startTime: call.startTime?.toISOString(),
          endTime: call.endTime?.toISOString(),
        },
      };
    } catch (error: any) {
      console.error('[TwilioService] Failed to get call:', error);
      return {
        success: false,
        error: error.message || 'Failed to get call',
        errorCode: error.code?.toString(),
      };
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const twilioService = new TwilioService();

export { TwilioService };
