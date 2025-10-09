/**
 * T043: Anthropic Claude Integration (Direct API)
 * Anthropic SDK streaming client for Claude 3 Sonnet
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.20.0';

export async function* streamClaude(prompt: string): AsyncGenerator<string> {
  /**
   * Stream responses from Claude 3 Sonnet via Anthropic API
   *
   * Yields text chunks as they arrive from the model
   */

  // Get API key from environment
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not configured. Set ANTHROPIC_API_KEY environment variable.'
    );
  }

  // Initialize Anthropic client
  const client = new Anthropic({
    apiKey,
  });

  // Model configuration - using Claude 3.5 Sonnet (latest)
  const modelId = 'claude-3-5-sonnet-20241022';

  try {
    // Create streaming request
    const stream = await client.messages.stream({
      model: modelId,
      max_tokens: 2048,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Process streaming response
    for await (const chunk of stream) {
      // Handle different event types
      if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    }
  } catch (error) {
    console.error('Anthropic streaming error:', error);
    throw error;
  }
}
