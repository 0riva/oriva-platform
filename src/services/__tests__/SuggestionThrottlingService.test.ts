import { SuggestionThrottlingService } from '../SuggestionThrottlingService';
import { createMockSupabaseClient } from '../../test-utils/supabase';

describe('SuggestionThrottlingService', () => {
  let service: SuggestionThrottlingService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new SuggestionThrottlingService(mockSupabase as any);
  });

  describe('shouldShowSuggestion', () => {
    it('should allow first suggestion for user', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.shouldShowSuggestion('user123', 'marketplace');

      expect(result).toBe(true);
    });

    it('should throttle suggestions when frequency limit exceeded', async () => {
      // Mock recent suggestions (already shown 3 times in last hour)
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [
                { shown_at: new Date().toISOString() },
                { shown_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
                { shown_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
              ],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.shouldShowSuggestion('user123', 'marketplace', {
        maxPerHour: 3,
      });

      expect(result).toBe(false);
    });

    it('should respect custom throttle limits', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [{ shown_at: new Date().toISOString() }],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.shouldShowSuggestion('user123', 'marketplace', {
        maxPerHour: 1,
      });

      expect(result).toBe(false);
    });

    it('should allow suggestions after throttle window expires', async () => {
      // Mock suggestion shown 2 hours ago
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [{ shown_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.shouldShowSuggestion('user123', 'marketplace', {
        maxPerHour: 3,
      });

      expect(result).toBe(true);
    });
  });

  describe('trackSuggestionShown', () => {
    it('should record suggestion display', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'track123',
                user_id: 'user123',
                suggestion_type: 'marketplace',
                shown_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      await service.trackSuggestionShown('user123', 'marketplace', {
        suggestion_id: 'suggestion123',
        context: { thread_id: 'thread123' },
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('suggestion_display_log');
    });

    it('should include metadata when tracking', async () => {
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: insertMock,
      });

      await service.trackSuggestionShown('user123', 'marketplace', {
        suggestion_id: 'suggestion123',
        context: { thread_id: 'thread123', placement: 'feed' },
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user123',
        suggestion_type: 'marketplace',
        suggestion_id: 'suggestion123',
        context: { thread_id: 'thread123', placement: 'feed' },
        shown_at: expect.any(String),
      });
    });
  });

  describe('getUserSuggestionPreferences', () => {
    it('should return default preferences for new user', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const prefs = await service.getUserSuggestionPreferences('user123');

      expect(prefs).toEqual({
        enabled: true,
        maxPerHour: 5,
        maxPerDay: 20,
        allowedTypes: ['marketplace', 'expertise', 'content'],
      });
    });

    it('should return user-specific preferences', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                enabled: true,
                max_per_hour: 3,
                max_per_day: 10,
                allowed_types: ['marketplace'],
              },
              error: null,
            }),
          }),
        }),
      });

      const prefs = await service.getUserSuggestionPreferences('user123');

      expect(prefs.maxPerHour).toBe(3);
      expect(prefs.maxPerDay).toBe(10);
      expect(prefs.allowedTypes).toEqual(['marketplace']);
    });

    it('should respect disabled suggestions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                enabled: false,
              },
              error: null,
            }),
          }),
        }),
      });

      const prefs = await service.getUserSuggestionPreferences('user123');

      expect(prefs.enabled).toBe(false);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user suggestion preferences', async () => {
      const upsertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'user123',
              max_per_hour: 2,
              enabled: true,
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      await service.updateUserPreferences('user123', {
        maxPerHour: 2,
      });

      expect(upsertMock).toHaveBeenCalledWith({
        user_id: 'user123',
        max_per_hour: 2,
      });
    });

    it('should allow disabling suggestions', async () => {
      const upsertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { enabled: false },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      await service.updateUserPreferences('user123', {
        enabled: false,
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('getSuggestionFrequency', () => {
    it('should calculate current suggestion frequency', async () => {
      // Mock 3 suggestions in last hour
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [
                { shown_at: new Date().toISOString() },
                { shown_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
                { shown_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
              ],
              error: null,
            }),
          }),
        }),
      });

      const frequency = await service.getSuggestionFrequency('user123', {
        windowHours: 1,
      });

      expect(frequency.count).toBe(3);
      expect(frequency.perHour).toBe(3);
    });

    it('should calculate frequency for custom time windows', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: Array(12).fill({ shown_at: new Date().toISOString() }),
              error: null,
            }),
          }),
        }),
      });

      const frequency = await service.getSuggestionFrequency('user123', {
        windowHours: 24,
      });

      expect(frequency.count).toBe(12);
      expect(frequency.perHour).toBe(0.5); // 12 in 24 hours = 0.5/hour
    });
  });

  describe('resetThrottling', () => {
    it('should clear throttling history for user', async () => {
      const deleteMock = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      await service.resetThrottling('user123');

      expect(mockSupabase.from).toHaveBeenCalledWith('suggestion_display_log');
    });

    it('should allow resetting specific suggestion types', async () => {
      const deleteMock = jest.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      });

      await service.resetThrottling('user123', 'marketplace');

      expect(mockSupabase.from).toHaveBeenCalledWith('suggestion_display_log');
    });
  });
});
