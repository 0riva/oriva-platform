/**
 * T043: Bedrock Claude Integration
 * AWS Bedrock streaming client for Claude 3 Sonnet
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from 'https://esm.sh/@aws-sdk/client-bedrock-runtime@3.490.0';

export async function* streamClaude(
  prompt: string,
  region: string = 'us-east-1'
): AsyncGenerator<string> {
  /**
   * Stream responses from Claude 3 Sonnet via AWS Bedrock
   *
   * Yields text chunks as they arrive from the model
   */

  // Initialize Bedrock client with explicit credentials to skip filesystem loading
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    );
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Model configuration
  const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelWithResponseStreamCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  try {
    const response = await client.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    // Process streaming response
    for await (const event of response.body) {
      if (event.chunk) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        // Handle different event types
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta?.text) {
            yield chunk.delta.text;
          }
        } else if (chunk.type === 'message_stop') {
          // Stream complete
          break;
        } else if (chunk.type === 'error') {
          throw new Error(`Bedrock error: ${chunk.error?.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Bedrock streaming error:', error);
    throw error;
  }
}
