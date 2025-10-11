// context-learner.ts - Extract coaching context from user messages

import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';

export interface ContextUpdate {
  goals?: string[];
  lifeEvents?: string[];
  stickingPoints?: string[];
}

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') || '',
});

/**
 * Extract goals, life events, and sticking points from user message
 * Uses Claude to analyze message and extract structured context
 */
export async function extractContextFromMessage(message: string): Promise<ContextUpdate> {
  const extractionPrompt = `You are analyzing a user's message in a relationship coaching conversation.
Extract the following information if present in the message:

1. Goals: What the user wants to achieve in their relationship life
   Example: "I want to find a long-term partner" → "Find long-term partner"

2. Life Events: Recent or significant events in the user's life
   Example: "I just got out of a 3-year relationship" → "Ended 3-year relationship"

3. Sticking Points: Concerns, fears, or obstacles they're facing
   Example: "I'm nervous about dating" → "Dating anxiety"

User Message: "${message}"

Respond ONLY with valid JSON in this exact format:
{
  "goals": ["goal1", "goal2"],
  "lifeEvents": ["event1", "event2"],
  "stickingPoints": ["point1", "point2"]
}

Rules:
- Each item should be a concise phrase (max 100 chars)
- Only include arrays with actual content (omit empty arrays)
- Return {} if no context is found
- Do not include explanations, only JSON`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {};
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in Claude response');
      return {};
    }

    const extracted: ContextUpdate = JSON.parse(jsonMatch[0]);

    // Validate and clean up
    const result: ContextUpdate = {};
    if (Array.isArray(extracted.goals) && extracted.goals.length > 0) {
      result.goals = extracted.goals.slice(0, 5); // Max 5 goals
    }
    if (Array.isArray(extracted.lifeEvents) && extracted.lifeEvents.length > 0) {
      result.lifeEvents = extracted.lifeEvents.slice(0, 5);
    }
    if (Array.isArray(extracted.stickingPoints) && extracted.stickingPoints.length > 0) {
      result.stickingPoints = extracted.stickingPoints.slice(0, 5);
    }

    return result;
  } catch (error) {
    console.error('Context extraction failed:', error);
    return {}; // Fail gracefully
  }
}

/**
 * Update user's coaching context by merging new extracted context
 * Non-destructive: appends to existing arrays, no duplicates
 */
export async function updateCoachingContext(
  supabase: any,
  userId: string,
  updates: ContextUpdate
): Promise<void> {
  if (Object.keys(updates).length === 0) {
    return; // Nothing to update
  }

  try {
    // Fetch current context
    const { data: existingDocs, error: fetchError } = await supabase
      .from('ai_documents')
      .select('content')
      .eq('tenant_id', userId)
      .eq('content_type', 'BaseCharacteristics')
      .single();

    if (fetchError) {
      console.error('Failed to fetch coaching context:', fetchError);
      return;
    }

    const currentContent = existingDocs?.content || {
      goals: [],
      lifeEvents: [],
      stickingPoints: [],
      currentStage: 'celebration',
    };

    // Merge arrays without duplicates
    const mergedContent = {
      ...currentContent,
      goals: mergeDedupe(currentContent.goals || [], updates.goals || []),
      lifeEvents: mergeDedupe(currentContent.lifeEvents || [], updates.lifeEvents || []),
      stickingPoints: mergeDedupe(
        currentContent.stickingPoints || [],
        updates.stickingPoints || []
      ),
    };

    // Update database
    const { error: updateError } = await supabase
      .from('ai_documents')
      .update({
        content: mergedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', userId)
      .eq('content_type', 'BaseCharacteristics');

    if (updateError) {
      console.error('Failed to update coaching context:', updateError);
    } else {
      console.log('Coaching context updated:', {
        goalsAdded: updates.goals?.length || 0,
        eventsAdded: updates.lifeEvents?.length || 0,
        pointsAdded: updates.stickingPoints?.length || 0,
      });
    }
  } catch (error) {
    console.error('updateCoachingContext failed:', error);
  }
}

/**
 * Merge two arrays and remove duplicates (case-insensitive)
 */
function mergeDedupe(existing: string[], newItems: string[]): string[] {
  const combined = [...existing, ...newItems];
  const seen = new Set<string>();
  return combined.filter((item) => {
    const normalized = item.toLowerCase().trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}
