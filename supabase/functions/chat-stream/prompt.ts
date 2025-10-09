/**
 * T044: Prompt Builder Module
 * Constructs Claude prompts with RAG context and user profile
 */

import { TICChunk } from './rag.ts';

export interface CoachingContext {
  currentStage: string;
  goals: string[];
  lifeEvents: string[];
  stickingPoints: string[];
  preferredTone?: string;
}

export interface UserProfile {
  display_name: string;
  beliefs?: string;
  deal_breakers?: string;
}

export function buildPrompt(
  userMessage: string,
  ragChunks: TICChunk[],
  context: CoachingContext,
  profile: UserProfile
): string {
  /**
   * Build comprehensive Claude prompt with:
   * - System instructions (Hugo's role)
   * - User profile context
   * - Coaching context (stage, goals, events)
   * - RAG content from TIC curriculum
   * - Current user message
   */

  const systemInstructions = `You are Hugo, an AI relationship coach based on The Intimacy Code (TIC) curriculum by Gavriel Shaw.

Your role is to provide supportive, evidence-based coaching to help users build meaningful connections and navigate their dating journey.

Key principles:
- Be warm, empathetic, and non-judgmental
- Ask thoughtful questions to deepen self-awareness
- Reference TIC concepts when relevant
- Adapt your tone to the user's current stage and emotional state
- Keep responses conversational and digestible (2-3 paragraphs max)
- Focus on actionable insights, not just theory`;

  const userProfileSection = `
USER PROFILE:
- Name: ${profile.display_name}
${profile.beliefs ? `- Beliefs: ${profile.beliefs}` : ''}
${profile.deal_breakers ? `- Deal-breakers: ${profile.deal_breakers}` : ''}`;

  const coachingContextSection = `
COACHING CONTEXT:
- Current Stage: ${formatStage(context.currentStage)}
${context.goals.length > 0 ? `- Goals: ${context.goals.join(', ')}` : ''}
${context.lifeEvents.length > 0 ? `- Recent Events: ${context.lifeEvents.join(', ')}` : ''}
${context.stickingPoints.length > 0 ? `- Challenges: ${context.stickingPoints.join(', ')}` : ''}`;

  const ragContentSection =
    ragChunks.length > 0
      ? `
RELEVANT TIC CONTENT:
${ragChunks
  .map(
    (chunk, i) => `
[${i + 1}] From ${chunk.metadata.workbookTitle} (Page ${chunk.metadata.pageNumber}):
${chunk.content}
`
  )
  .join('\n')}`
      : '';

  const toneGuidance = context.preferredTone
    ? `\nAdapt your tone to be ${context.preferredTone}.`
    : '';

  // Construct full prompt
  const fullPrompt = `${systemInstructions}

${userProfileSection}

${coachingContextSection}

${ragContentSection}

USER MESSAGE:
${userMessage}

${toneGuidance}

Respond with supportive coaching advice based on TIC curriculum and the user's context. Be conversational and concise.`;

  return fullPrompt;
}

function formatStage(stage: string): string {
  /**
   * Format stage name for display
   */
  const stageNames: Record<string, string> = {
    celebration: 'Celebration - Enjoying singlehood',
    connection: 'Vital Connection - Building deep bonds',
    spark: 'Love-Spark - Early dating excitement',
    payOff: 'Big Pay-Off - Committed relationship',
    spiral: 'Spiral Effect - Long-term growth',
  };

  return stageNames[stage] || stage;
}
