// stage-detector.ts - Automatically detect coaching stage transitions

import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';

export type CoachingStage = 'celebration' | 'connection' | 'spark' | 'payOff' | 'spiral';

export interface StageDetectionResult {
  suggestedStage: CoachingStage;
  confidence: number;
  reasoning: string;
}

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
});

/**
 * Detect coaching stage from conversation context
 * Uses Claude to analyze recent messages and context to determine current stage
 */
export async function detectStage(
  recentMessages: Array<{ role: string; content: string }>,
  currentContext: {
    goals?: string[];
    lifeEvents?: string[];
    stickingPoints?: string[];
    currentStage: string;
  }
): Promise<StageDetectionResult> {
  const stageDescriptions = `
Coaching Stages:
1. CELEBRATION (Single, enjoying independence)
   - Focus: Self-discovery, independence, pleasure, passion, authenticity
   - Indicators: Recently single, exploring identity, enjoying solo time
   - Keywords: single, independence, self-discovery, healing from breakup

2. CONNECTION (Meeting someone, early attraction)
   - Focus: Respect, values alignment, mission, empathy
   - Indicators: Met someone new, early dating, exploring compatibility
   - Keywords: met someone, first date, getting to know, attraction

3. SPARK (Dating, building connection)
   - Focus: Together, compatibility, affection, purpose, excitement
   - Indicators: Regular dating, building relationship, early commitment
   - Keywords: dating, relationship building, connection growing

4. PAYOFF (Committed relationship, deepening intimacy)
   - Focus: Pride, support, surrender, intimacy, long-term
   - Indicators: Committed partnership, deepening bond, shared life
   - Keywords: committed, partnership, deep connection, living together

5. SPIRAL (Long-term partnership, growth and evolution)
   - Focus: Creation, harmony, evolution, development, resilience
   - Indicators: Established relationship, growth together, future planning
   - Keywords: long-term, marriage, family, growth, evolution
`;

  const conversationSummary = recentMessages
    .slice(-5) // Last 5 messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const detectionPrompt = `You are analyzing a coaching conversation to determine the user's current relationship stage.

${stageDescriptions}

Current Stage: ${currentContext.currentStage}

User Context:
- Goals: ${currentContext.goals?.join(', ') || 'None'}
- Life Events: ${currentContext.lifeEvents?.join(', ') || 'None'}
- Sticking Points: ${currentContext.stickingPoints?.join(', ') || 'None'}

Recent Conversation:
${conversationSummary}

Based on the conversation and context, what coaching stage is the user ACTUALLY in?

Respond ONLY with valid JSON in this exact format:
{
  "suggestedStage": "celebration" | "connection" | "spark" | "payOff" | "spiral",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation (max 100 chars)"
}

Rules:
- confidence >= 0.8 is required for stage transition recommendation
- Consider user's explicit statements more than implied context
- If unsure, suggest current stage with lower confidence
- Do not include explanations, only JSON`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: detectionPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return createDefaultResult(currentContext.currentStage);
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in stage detection response');
      return createDefaultResult(currentContext.currentStage);
    }

    const result: StageDetectionResult = JSON.parse(jsonMatch[0]);

    // Validate result
    if (!isValidStage(result.suggestedStage)) {
      console.error('Invalid stage detected:', result.suggestedStage);
      return createDefaultResult(currentContext.currentStage);
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      console.error('Invalid confidence:', result.confidence);
      return createDefaultResult(currentContext.currentStage);
    }

    return result;
  } catch (error) {
    console.error('Stage detection failed:', error);
    return createDefaultResult(currentContext.currentStage);
  }
}

/**
 * Update coaching stage if confidence threshold met
 * Only updates if confidence >= 0.8 and stage is different from current
 */
export async function updateStageIfNeeded(
  supabase: any,
  userId: string,
  conversationId: string,
  detection: StageDetectionResult,
  currentStage: string
): Promise<boolean> {
  const CONFIDENCE_THRESHOLD = 0.8;

  if (detection.confidence < CONFIDENCE_THRESHOLD) {
    console.log(
      `Stage confidence too low (${detection.confidence.toFixed(2)}) - keeping ${currentStage}`
    );
    return false;
  }

  if (detection.suggestedStage === currentStage) {
    console.log(`Stage detection confirms current stage: ${currentStage}`);
    return false;
  }

  try {
    // Fetch current coaching context
    const { data: contextData, error: fetchError } = await supabase
      .from('ai_documents')
      .select('content')
      .eq('tenant_id', userId)
      .eq('content_type', 'BaseCharacteristics')
      .single();

    if (fetchError || !contextData) {
      console.error('Failed to fetch current context:', fetchError);
      return false;
    }

    // Update currentStage in the content object
    const updatedContent = {
      ...contextData.content,
      currentStage: detection.suggestedStage,
    };

    // Update ai_documents coaching context
    const { error: contextError } = await supabase
      .from('ai_documents')
      .update({
        content: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', userId)
      .eq('content_type', 'BaseCharacteristics');

    if (contextError) {
      console.error('Failed to update stage in context:', contextError);
      return false;
    }

    // Update conversation current_stage
    const { error: convError } = await supabase
      .from('conversations')
      .update({
        current_stage: detection.suggestedStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (convError) {
      console.error('Failed to update conversation stage:', convError);
      return false;
    }

    console.log(
      `Stage transition: ${currentStage} → ${detection.suggestedStage} (confidence: ${detection.confidence.toFixed(
        2
      )})`
    );
    console.log(`Reasoning: ${detection.reasoning}`);

    return true;
  } catch (error) {
    console.error('updateStageIfNeeded failed:', error);
    return false;
  }
}

/**
 * Validate coaching stage value
 */
function isValidStage(stage: string): stage is CoachingStage {
  return ['celebration', 'connection', 'spark', 'payOff', 'spiral'].includes(stage);
}

/**
 * Create default result keeping current stage
 */
function createDefaultResult(currentStage: string): StageDetectionResult {
  return {
    suggestedStage: currentStage as CoachingStage,
    confidence: 0.5,
    reasoning: 'Insufficient information for stage change',
  };
}
