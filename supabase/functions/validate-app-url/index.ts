/**
 * Supabase Edge Function: validate-app-url
 *
 * Validates external app URLs for accessibility, security, and performance
 * This function runs server-side to bypass CORS restrictions when checking URLs
 *
 * Request body:
 * - url: string - The URL to validate
 * - timeoutMs: number (optional) - Request timeout in milliseconds (default: 10000)
 *
 * Response:
 * - success: boolean
 * - data: {
 *     accessible: boolean
 *     responseTime: number
 *     error?: string
 *     headers?: Record<string, string>
 *   }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

interface ValidationRequest {
  url: string;
  timeoutMs?: number;
}

interface ValidationResponse {
  accessible: boolean;
  responseTime: number;
  error?: string;
  headers?: Record<string, string>;
}

serve(async (req) => {
  // CORS headers for client requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: ValidationRequest = await req.json();
    const { url, timeoutMs = 10000 } = body;

    if (!url) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'URL is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          data: {
            accessible: false,
            responseTime: 0,
            error: 'Invalid URL format',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check URL accessibility with timeout
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let validationResult: ValidationResponse;

    try {
      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD to avoid downloading content
        signal: controller.signal,
        headers: {
          'User-Agent': 'Oriva-App-Validator/1.0',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      // Check if response is successful (2xx or 3xx status codes)
      const isAccessible = response.status >= 200 && response.status < 400;

      if (isAccessible) {
        validationResult = {
          accessible: true,
          responseTime,
          headers,
        };
      } else {
        validationResult = {
          accessible: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          headers,
        };
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else {
          errorMessage = error.message || 'Network error';
        }
      }

      validationResult = {
        accessible: false,
        responseTime,
        error: errorMessage,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: validationResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Edge Function error:', error);

    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
