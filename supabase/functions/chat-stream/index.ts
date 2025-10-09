/**
 * T041 & T045: Chat Stream Handler - Main Entry Point
 * SSE endpoint for Hugo coaching chat with RAG + Claude streaming
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { searchTICChunks } from './rag.ts';
import { streamClaude } from './anthropic.ts';
import { buildPrompt, CoachingContext, UserProfile } from './prompt.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-dev-user-id',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // DEBUG: Log all incoming headers to diagnose x-dev-user-id issue
    console.log('=== INCOMING REQUEST HEADERS ===');
    for (const [key, value] of req.headers.entries()) {
      // Mask sensitive tokens but show header presence
      if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'apikey') {
        console.log(`${key}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    console.log('=== END HEADERS ===');

    // Parse request body
    const body = await req.json();
    const conversationId = body.conversation_id || body.conversationId;
    const message = body.message;

    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: 'Missing conversationId or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from JWT token OR use dev mode
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    let userId: string;

    // DEV MODE: For local testing, bypass JWT entirely
    if (
      supabaseUrl.includes('127.0.0.1') ||
      supabaseUrl.includes('localhost') ||
      supabaseUrl.includes('kong')
    ) {
      // Try dev header first, otherwise use hardcoded test user
      userId = req.headers.get('x-dev-user-id') || '00000000-0000-0000-0000-000000000001';
      console.log(`DEV MODE: Using user ID ${userId}`);
    } else {
      // Production mode - check for dev header first (for testing), then require JWT
      const devUserId = req.headers.get('x-dev-user-id');

      if (devUserId) {
        // Testing mode: use provided dev user ID
        userId = devUserId;
        console.log(`PRODUCTION TEST MODE: Using dev user ID ${userId}`);
      } else {
        // Normal production: require JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create Supabase client with user context
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: { Authorization: authHeader },
          },
        });

        // Get user from JWT
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        userId = user.id;
      }
    }

    // Create Supabase client for data operations (service role key bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'hugo_love',
      },
    });

    // Fetch user's coaching context from ai_documents
    const { data: aiDocs, error: contextError } = await supabase
      .from('ai_documents')
      .select('*')
      .eq('tenant_id', userId)
      .eq('content_type', 'BaseCharacteristics')
      .single();

    const coachingContext: CoachingContext = aiDocs?.content || {
      currentStage: 'celebration',
      goals: [],
      lifeEvents: [],
      stickingPoints: [],
    };

    // Fetch user profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    const userProfile: UserProfile = {
      display_name: profileData?.profile_data?.display_name || 'there',
      beliefs: profileData?.profile_data?.beliefs,
      deal_breakers: profileData?.profile_data?.deal_breakers,
    };

    // Search for relevant TIC chunks using RAG
    const ragChunks = await searchTICChunks(
      message,
      coachingContext.currentStage,
      supabaseUrl,
      supabaseKey,
      5 // top 5 chunks
    );

    console.log(`Found ${ragChunks.length} relevant TIC chunks`);

    // Build Claude prompt with all context
    const claudePrompt = buildPrompt(message, ragChunks, coachingContext, userProfile);

    // Store user message in database
    const { data: userMsgData, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
    } else {
      console.log('User message saved:', userMsgData?.id);
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          let fullResponse = '';

          // Stream Claude response
          for await (const chunk of streamClaude(claudePrompt)) {
            fullResponse += chunk;

            // Send SSE event
            const sseData = `event: message\ndata: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Store assistant message in database
          const ticChunkIds = ragChunks.map((c) => c.id);

          const { data: assistantMsgData, error: assistantMsgError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              user_id: userId,
              role: 'assistant',
              content: fullResponse,
              tone: coachingContext.preferredTone || 'friendly',
              tags: [coachingContext.currentStage],
              tic_chunk_ids: ticChunkIds,
            })
            .select()
            .single();

          if (assistantMsgError) {
            console.error('Failed to save assistant message:', assistantMsgError);
          } else {
            console.log('Assistant message saved:', assistantMsgData?.id);
          }

          // Update conversation metadata
          // Note: message_count increment removed due to supabase.raw() limitation
          // Messages are still saved individually in messages table
          await supabase
            .from('conversations')
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);

          // Send done event
          const doneEvent = `event: done\ndata: ${JSON.stringify({ message_id: 'completed' })}\n\n`;
          controller.enqueue(encoder.encode(doneEvent));

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);

          // Send error event
          const errorEvent = `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));

          controller.close();
        }
      },
    });

    // Return SSE stream
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);

    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
