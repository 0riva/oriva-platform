import { SupabaseClient } from '@supabase/supabase-js';

export type SuggestionType = 'marketplace' | 'expertise' | 'content' | 'community';

export interface ThrottleOptions {
  maxPerHour?: number;
  maxPerDay?: number;
  windowHours?: number;
}

export interface TrackingMetadata {
  suggestion_id?: string;
  context?: Record<string, any>;
}

export interface SuggestionPreferences {
  enabled: boolean;
  maxPerHour: number;
  maxPerDay: number;
  allowedTypes: SuggestionType[];
}

export interface SuggestionFrequency {
  count: number;
  perHour: number;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * SuggestionThrottlingService limits the frequency of suggestions shown to users.
 *
 * Prevents suggestion fatigue by throttling display frequency and respecting
 * user preferences for suggestion types and cadence.
 */
export class SuggestionThrottlingService {
  private readonly DEFAULT_MAX_PER_HOUR = 5;
  private readonly DEFAULT_MAX_PER_DAY = 20;

  constructor(private supabase: SupabaseClient) {}

  /**
   * Check if a suggestion should be shown to the user
   */
  async shouldShowSuggestion(
    userId: string,
    suggestionType: SuggestionType,
    options?: ThrottleOptions
  ): Promise<boolean> {
    // Get user preferences
    const prefs = await this.getUserSuggestionPreferences(userId);

    // Check if suggestions are enabled
    if (!prefs.enabled) {
      return false;
    }

    // Check if this suggestion type is allowed
    if (!prefs.allowedTypes.includes(suggestionType)) {
      return false;
    }

    const maxPerHour = options?.maxPerHour ?? prefs.maxPerHour;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check recent suggestions in the last hour
    const { data: recentSuggestions, error } = await this.supabase
      .from('suggestion_display_log')
      .select('shown_at')
      .eq('user_id', userId)
      .eq('suggestion_type', suggestionType)
      .gte('shown_at', oneHourAgo.toISOString());

    if (error) throw error;

    // Check if under throttle limit
    const count = recentSuggestions?.length ?? 0;
    return count < maxPerHour;
  }

  /**
   * Track that a suggestion was shown to the user
   */
  async trackSuggestionShown(
    userId: string,
    suggestionType: SuggestionType,
    metadata?: TrackingMetadata
  ): Promise<void> {
    const { error } = await this.supabase
      .from('suggestion_display_log')
      .insert({
        user_id: userId,
        suggestion_type: suggestionType,
        suggestion_id: metadata?.suggestion_id,
        context: metadata?.context,
        shown_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
  }

  /**
   * Get user's suggestion preferences
   */
  async getUserSuggestionPreferences(userId: string): Promise<SuggestionPreferences> {
    const { data, error } = await this.supabase
      .from('user_suggestion_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults for new users
      return {
        enabled: true,
        maxPerHour: this.DEFAULT_MAX_PER_HOUR,
        maxPerDay: this.DEFAULT_MAX_PER_DAY,
        allowedTypes: ['marketplace', 'expertise', 'content'],
      };
    }

    return {
      enabled: data.enabled ?? true,
      maxPerHour: data.max_per_hour ?? this.DEFAULT_MAX_PER_HOUR,
      maxPerDay: data.max_per_day ?? this.DEFAULT_MAX_PER_DAY,
      allowedTypes: data.allowed_types ?? ['marketplace', 'expertise', 'content'],
    };
  }

  /**
   * Update user's suggestion preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<SuggestionPreferences, 'enabled'> & { enabled?: boolean }>
  ): Promise<SuggestionPreferences> {
    const { data, error } = await this.supabase
      .from('user_suggestion_preferences')
      .upsert({
        user_id: userId,
        enabled: updates.enabled,
        max_per_hour: updates.maxPerHour,
        max_per_day: updates.maxPerDay,
        allowed_types: updates.allowedTypes,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      enabled: data.enabled,
      maxPerHour: data.max_per_hour,
      maxPerDay: data.max_per_day,
      allowedTypes: data.allowed_types,
    };
  }

  /**
   * Get current suggestion frequency for a user
   */
  async getSuggestionFrequency(
    userId: string,
    options?: { windowHours?: number; suggestionType?: SuggestionType }
  ): Promise<SuggestionFrequency> {
    const windowHours = options?.windowHours ?? 1;
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const windowEnd = new Date();

    let query = this.supabase
      .from('suggestion_display_log')
      .select('shown_at')
      .eq('user_id', userId)
      .gte('shown_at', windowStart.toISOString());

    if (options?.suggestionType) {
      query = query.eq('suggestion_type', options.suggestionType);
    }

    const { data, error } = await query;

    if (error) throw error;

    const count = data?.length ?? 0;
    const perHour = count / windowHours;

    return {
      count,
      perHour,
      windowStart,
      windowEnd,
    };
  }

  /**
   * Reset throttling history for a user
   */
  async resetThrottling(
    userId: string,
    suggestionType?: SuggestionType
  ): Promise<void> {
    let query = this.supabase
      .from('suggestion_display_log')
      .delete()
      .eq('user_id', userId);

    if (suggestionType) {
      query = query.eq('suggestion_type', suggestionType);
    }

    const { error } = await query;

    if (error) throw error;
  }

  /**
   * Check daily suggestion limit
   */
  async hasReachedDailyLimit(
    userId: string,
    suggestionType: SuggestionType
  ): Promise<boolean> {
    const prefs = await this.getUserSuggestionPreferences(userId);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('suggestion_display_log')
      .select('shown_at')
      .eq('user_id', userId)
      .eq('suggestion_type', suggestionType)
      .gte('shown_at', oneDayAgo.toISOString());

    if (error) throw error;

    const count = data?.length ?? 0;
    return count >= prefs.maxPerDay;
  }

  /**
   * Get optimal time to show next suggestion
   */
  async getNextSuggestionTime(
    userId: string,
    suggestionType: SuggestionType
  ): Promise<Date | null> {
    const prefs = await this.getUserSuggestionPreferences(userId);

    if (!prefs.enabled || !prefs.allowedTypes.includes(suggestionType)) {
      return null;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('suggestion_display_log')
      .select('shown_at')
      .eq('user_id', userId)
      .eq('suggestion_type', suggestionType)
      .gte('shown_at', oneHourAgo.toISOString())
      .order('shown_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      // No recent suggestions, can show now
      return new Date();
    }

    // Calculate when the hourly limit will reset
    const lastShown = new Date(data[0].shown_at);
    const nextAvailable = new Date(lastShown.getTime() + (60 * 60 * 1000) / prefs.maxPerHour);

    return nextAvailable > new Date() ? nextAvailable : new Date();
  }
}
