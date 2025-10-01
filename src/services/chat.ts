// @ts-nocheck - TODO: Fix type errors
// Task: T045 - Chat service with multi-layered AI composition
// Description: Compose Core HugoAI + App Knowledge + User Context

import { getSupabaseClient } from '../config/supabase';
import { searchKnowledge } from './knowledge';

export interface ChatContext {
  appId: string;
  userId: string;
  conversationId: string;
  message: string;
  additionalContext?: {
    current_goals?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface ChatComposedContext {
  // App configuration
  app: {
    app_id: string;
    display_name: string;
    domain: string;
  };

  // Personality schema
  personality: {
    tone: string;
    focus: string[];
    constraints: string[];
    voice_characteristics?: Record<string, number>;
  };

  // Knowledge sources
  knowledge: Array<{
    title: string;
    content: string;
    relevance_score: number;
  }>;

  // User context
  user: {
    progress_data: Record<string, unknown>;
    current_focus_area: string | null;
    milestones_reached: string[];
  };

  // Conversation history
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;

  // Current message
  message: string;
  additional_context?: Record<string, unknown>;
}

/**
 * Compose full context for AI chat request
 * Layers: Core HugoAI + App-specific + User context (FR-001, FR-002)
 */
export async function composeChatContext(
  context: ChatContext,
): Promise<ChatComposedContext> {
  const { appId, userId, conversationId, message, additionalContext } = context;
  const supabase = getSupabaseClient();

  // 1. Get app configuration and personality schema
  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select(`
      app_id,
      display_name,
      domain,
      personality_schemas (
        schema
      )
    `)
    .eq('app_id', appId)
    .eq('is_active', true)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

  // 2. Search knowledge base for relevant content (FR-005)
  const knowledgeResults = await searchKnowledge({
    query: message,
    appId: appId,
    maxResults: 5,
    minRelevance: 0.3,
  });

  // 3. Get user progress
  const { data: progressData } = await supabase
    .from('hugo_user_progress')
    .select('progress_data, current_focus_area, milestones_reached')
    .eq('user_id', userId)
    .eq('app_id', appData.app_id)
    .single();

  // 4. Get recent conversation history (FR-010, FR-011)
  const { data: messages } = await supabase
    .from('hugo_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(10);

  // 5. Compose context
  const personalitySchema = (appData.personality_schemas as { schema: Record<string, unknown> })?.schema || {};

  return {
    app: {
      app_id: appData.app_id,
      display_name: appData.display_name,
      domain: appData.domain,
    },
    personality: {
      tone: (personalitySchema.tone as string) || 'warm',
      focus: (personalitySchema.focus as string[]) || [],
      constraints: (personalitySchema.constraints as string[]) || [],
      voice_characteristics: personalitySchema.voice_characteristics as Record<string, number>,
    },
    knowledge: knowledgeResults.results.map((r) => ({
      title: r.title,
      content: r.content,
      relevance_score: r.relevance_score,
    })),
    user: {
      progress_data: progressData?.progress_data || {},
      current_focus_area: progressData?.current_focus_area || null,
      milestones_reached: progressData?.milestones_reached || [],
    },
    history: (messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      created_at: m.created_at,
    })),
    message: message,
    additional_context: additionalContext,
  };
}

/**
 * Build system prompt from composed context
 */
export function buildSystemPrompt(context: ChatComposedContext): string {
  const { app, personality, knowledge, user } = context;

  let systemPrompt = `You are ${app.display_name}, an AI coaching assistant specializing in ${app.domain}.

PERSONALITY:
- Tone: ${personality.tone}
- Focus areas: ${personality.focus.join(', ')}
- Constraints: ${personality.constraints.join(', ')}

`;

  // Add knowledge sources
  if (knowledge.length > 0) {
    systemPrompt += `RELEVANT KNOWLEDGE:\n`;
    knowledge.forEach((k, i) => {
      systemPrompt += `${i + 1}. ${k.title}\n${k.content.substring(0, 500)}...\n\n`;
    });
  }

  // Add user context
  if (user.current_focus_area) {
    systemPrompt += `USER CONTEXT:\n`;
    systemPrompt += `- Current focus: ${user.current_focus_area}\n`;
  }

  if (user.milestones_reached.length > 0) {
    systemPrompt += `- Milestones achieved: ${user.milestones_reached.join(', ')}\n`;
  }

  systemPrompt += `\nProvide helpful, personalized coaching based on the user's context and the knowledge available.`;

  return systemPrompt;
}

/**
 * Save message to conversation
 */
export async function saveMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  confidenceScore?: number;
  generationTimeMs?: number;
  tokensUsed?: number;
}): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('hugo_messages')
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      model: params.model,
      confidence_score: params.confidenceScore,
      generation_time_ms: params.generationTimeMs,
      tokens_used: params.tokensUsed,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save message: ${error?.message}`);
  }

  // Update conversation message_count and last_message_at
  await supabase.rpc('update_conversation_metadata', {
    conversation_id: params.conversationId,
  });

  return data.id;
}