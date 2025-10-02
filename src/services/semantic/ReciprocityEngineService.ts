import { SupabaseClient } from '@supabase/supabase-js';

export type ContributionType =
  | 'content_creation'
  | 'expertise_sharing'
  | 'commerce_facilitation'
  | 'community_support';

export type BenefitType =
  | 'purchase'
  | 'expertise_received'
  | 'connection'
  | 'opportunity';

export type ReciprocityLevel =
  | 'generous'
  | 'balanced'
  | 'receiver';

export interface Contribution {
  id?: string;
  user_id?: string;
  type: ContributionType;
  value: number;
  description?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface Benefit {
  id?: string;
  user_id?: string;
  type: BenefitType;
  value: number;
  description?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface ContributionBalance {
  total: number;
  byType: Record<string, number>;
}

export interface ReciprocityScore {
  giveValue: number;
  takeValue: number;
  ratio: number;
  level: ReciprocityLevel;
}

export interface ReciprocityAction {
  type: 'contribute' | 'receive' | 'balance';
  priority: 'high' | 'medium' | 'low';
  description?: string;
  metadata?: Record<string, any>;
}

export interface ReciprocityInsights {
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  mostFrequentContribution: ContributionType | null;
  suggestions: ReciprocityAction[];
}

/**
 * ReciprocityEngineService tracks contribution balance across the platform.
 *
 * Tracks what users contribute (content, expertise, commerce) vs what they receive
 * (purchases, knowledge, connections) to maintain healthy platform dynamics.
 */
export class ReciprocityEngineService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Track a contribution made by a user
   */
  async trackContribution(
    userId: string,
    contribution: Omit<Contribution, 'id' | 'user_id' | 'created_at'>
  ): Promise<Contribution> {
    const { data, error } = await this.supabase
      .from('reciprocity_contributions')
      .insert({
        user_id: userId,
        ...contribution,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Track a benefit received by a user
   */
  async trackBenefit(
    userId: string,
    benefit: Omit<Benefit, 'id' | 'user_id' | 'created_at'>
  ): Promise<Benefit> {
    const { data, error } = await this.supabase
      .from('reciprocity_benefits')
      .insert({
        user_id: userId,
        benefit_type: benefit.type,
        value: benefit.value,
        description: benefit.description,
        metadata: benefit.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get total contribution balance for a user
   */
  async getContributionBalance(userId: string): Promise<ContributionBalance> {
    const { data, error } = await this.supabase
      .from('reciprocity_contributions')
      .select('type, value')
      .eq('user_id', userId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { total: 0, byType: {} };
    }

    const byType: Record<string, number> = {};
    let total = 0;

    for (const contribution of data) {
      total += contribution.value;
      byType[contribution.type] = (byType[contribution.type] || 0) + contribution.value;
    }

    return { total, byType };
  }

  /**
   * Calculate reciprocity score (give/take ratio)
   */
  async getReciprocityScore(userId: string): Promise<ReciprocityScore> {
    // Get contributions (give)
    const { data: contributions, error: contribError } = await this.supabase
      .from('reciprocity_contributions')
      .select('value')
      .eq('user_id', userId);

    if (contribError) throw contribError;

    // Get benefits (take)
    const { data: benefits, error: benefitError } = await this.supabase
      .from('reciprocity_benefits')
      .select('value')
      .eq('user_id', userId);

    if (benefitError) throw benefitError;

    const giveValue = contributions?.reduce((sum, c) => sum + c.value, 0) || 0;
    const takeValue = benefits?.reduce((sum, b) => sum + b.value, 0) || 0;

    // Calculate ratio (handle division by zero)
    let ratio = 1.0; // Neutral for new users
    if (takeValue > 0) {
      ratio = giveValue / takeValue;
    } else if (giveValue > 0) {
      ratio = 10.0; // Very generous if giving without taking
    }

    // Determine level
    let level: ReciprocityLevel;
    if (ratio >= 2.0) {
      level = 'generous';
    } else if (ratio >= 0.8 && ratio <= 1.5) {
      level = 'balanced';
    } else {
      level = 'receiver';
    }

    return {
      giveValue,
      takeValue,
      ratio,
      level,
    };
  }

  /**
   * Suggest actions to improve reciprocity balance
   */
  async suggestReciprocityActions(
    userId: string,
    context?: { userExpertise?: string[] }
  ): Promise<ReciprocityAction[]> {
    const score = await this.getReciprocityScore(userId);
    const suggestions: ReciprocityAction[] = [];

    if (score.level === 'receiver') {
      // User takes more than gives - suggest contribution opportunities
      suggestions.push({
        type: 'contribute',
        priority: 'high',
        description: 'Share your expertise by creating content or helping others',
        metadata: { targetRatio: 1.0 },
      });

      if (context?.userExpertise && context.userExpertise.length > 0) {
        suggestions.push({
          type: 'contribute',
          priority: 'high',
          description: `Create content about ${context.userExpertise.join(', ')}`,
          metadata: { expertise: context.userExpertise },
        });
      }
    } else if (score.level === 'generous') {
      // User gives significantly - suggest they can also receive
      suggestions.push({
        type: 'receive',
        priority: 'medium',
        description: 'Explore marketplace for tools that could help your work',
        metadata: { targetRatio: 1.0 },
      });
    } else {
      // Balanced - maintain current behavior
      suggestions.push({
        type: 'balance',
        priority: 'low',
        description: 'Continue your balanced approach to giving and receiving',
      });
    }

    return suggestions;
  }

  /**
   * Get reciprocity insights and trends for a user
   */
  async getReciprocityInsights(userId: string): Promise<ReciprocityInsights> {
    // Get contribution history with timestamps
    const { data: contributions, error: contribError } = await this.supabase
      .from('reciprocity_contributions')
      .select('type, value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (contribError) throw contribError;

    // Get benefit history
    const { data: benefits, error: benefitError } = await this.supabase
      .from('reciprocity_benefits')
      .select('value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (benefitError) throw benefitError;

    // Calculate trend (comparing recent vs older activity)
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (contributions && contributions.length >= 2) {
      const midpoint = Math.floor(contributions.length / 2);
      const olderSum = contributions.slice(0, midpoint).reduce((sum, c) => sum + c.value, 0);
      const recentSum = contributions.slice(midpoint).reduce((sum, c) => sum + c.value, 0);

      if (recentSum > olderSum * 1.2) {
        trendDirection = 'increasing';
      } else if (recentSum < olderSum * 0.8) {
        trendDirection = 'decreasing';
      }
    }

    // Find most frequent contribution type
    const typeCounts: Record<string, number> = {};
    let mostFrequentContribution: ContributionType | null = null;
    let maxCount = 0;

    if (contributions) {
      for (const contrib of contributions) {
        typeCounts[contrib.type] = (typeCounts[contrib.type] || 0) + 1;
        if (typeCounts[contrib.type] > maxCount) {
          maxCount = typeCounts[contrib.type];
          mostFrequentContribution = contrib.type as ContributionType;
        }
      }
    }

    // Generate suggestions based on insights
    const suggestions = await this.suggestReciprocityActions(userId);

    return {
      trendDirection,
      mostFrequentContribution,
      suggestions,
    };
  }
}
