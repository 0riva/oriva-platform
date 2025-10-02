import { ReciprocityEngineService } from '../ReciprocityEngineService';
import { createMockSupabaseClient } from '../../../test-utils/supabase';

describe('ReciprocityEngineService', () => {
  let service: ReciprocityEngineService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new ReciprocityEngineService(mockSupabase as any);
  });

  describe('trackContribution', () => {
    it('should track a contribution from user', async () => {
      const userId = 'user123';
      const contribution = {
        type: 'content_creation' as const,
        value: 100,
        description: 'Created helpful guide',
        metadata: { itemId: 'item123' },
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'contribution123',
                user_id: userId,
                ...contribution,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.trackContribution(userId, contribution);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(userId);
      expect(result.type).toBe('content_creation');
    });

    it('should support different contribution types', async () => {
      const types = ['content_creation', 'expertise_sharing', 'commerce_facilitation', 'community_support'] as const;

      for (const type of types) {
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'test', type },
                error: null,
              }),
            }),
          }),
        });

        const result = await service.trackContribution('user123', { type, value: 50 });
        expect(result.type).toBe(type);
      }
    });
  });

  describe('getContributionBalance', () => {
    it('should calculate total contribution balance for user', async () => {
      const userId = 'user123';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { type: 'content_creation', value: 100 },
              { type: 'expertise_sharing', value: 50 },
              { type: 'commerce_facilitation', value: 75 },
            ],
            error: null,
          }),
        }),
      });

      const balance = await service.getContributionBalance(userId);

      expect(balance.total).toBe(225);
      expect(balance.byType.content_creation).toBe(100);
      expect(balance.byType.expertise_sharing).toBe(50);
      expect(balance.byType.commerce_facilitation).toBe(75);
    });

    it('should return zero balance for user with no contributions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const balance = await service.getContributionBalance('newuser');

      expect(balance.total).toBe(0);
      expect(balance.byType).toEqual({});
    });
  });

  describe('getReciprocityScore', () => {
    it('should calculate reciprocity score based on give/take ratio', async () => {
      const userId = 'user123';

      // Mock contributions (give)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { type: 'content_creation', value: 100 },
              { type: 'expertise_sharing', value: 50 },
            ],
            error: null,
          }),
        }),
      });

      // Mock benefits received (take)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { benefit_type: 'purchase', value: 50 },
            ],
            error: null,
          }),
        }),
      });

      const score = await service.getReciprocityScore(userId);

      // Give: 150, Take: 50, Ratio: 150/50 = 3.0
      expect(score.giveValue).toBe(150);
      expect(score.takeValue).toBe(50);
      expect(score.ratio).toBe(3.0);
      expect(score.level).toBe('generous'); // Ratio > 2.0
    });

    it('should classify reciprocity levels correctly', async () => {
      const testCases = [
        { give: 100, take: 10, expectedLevel: 'generous' },  // 10.0 ratio
        { give: 100, take: 50, expectedLevel: 'generous' },  // 2.0 ratio
        { give: 100, take: 80, expectedLevel: 'balanced' },  // 1.25 ratio
        { give: 100, take: 100, expectedLevel: 'balanced' }, // 1.0 ratio
        { give: 50, take: 100, expectedLevel: 'receiver' },  // 0.5 ratio
      ];

      for (const testCase of testCases) {
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ value: testCase.give }],
              error: null,
            }),
          }),
        });

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ value: testCase.take }],
              error: null,
            }),
          }),
        });

        const score = await service.getReciprocityScore('user');
        expect(score.level).toBe(testCase.expectedLevel);
      }
    });

    it('should handle new users with no activity', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const score = await service.getReciprocityScore('newuser');

      expect(score.giveValue).toBe(0);
      expect(score.takeValue).toBe(0);
      expect(score.ratio).toBe(1.0); // Neutral for new users
      expect(score.level).toBe('balanced');
    });
  });

  describe('suggestReciprocityActions', () => {
    it('should suggest contribution opportunities for receivers', async () => {
      const userId = 'user123';

      // Mock low reciprocity score (receiver)
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ value: 10 }], // Low give, high take assumed
            error: null,
          }),
        }),
      });

      const suggestions = await service.suggestReciprocityActions(userId);

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'contribute',
          priority: 'high',
        })
      );
    });

    it('should suggest opportunities matching user expertise', async () => {
      const userId = 'user123';

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const suggestions = await service.suggestReciprocityActions(userId, {
        userExpertise: ['javascript', 'react'],
      });

      const jsOpportunity = suggestions.find(s =>
        s.description?.toLowerCase().includes('javascript') ||
        s.description?.toLowerCase().includes('react')
      );

      expect(jsOpportunity).toBeDefined();
    });
  });

  describe('trackBenefit', () => {
    it('should track benefit received by user', async () => {
      const userId = 'user123';
      const benefit = {
        type: 'purchase' as const,
        value: 100,
        description: 'Purchased AI template',
        metadata: { itemId: 'item123' },
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'benefit123',
                user_id: userId,
                ...benefit,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await service.trackBenefit(userId, benefit);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(userId);
      expect(result.type).toBe('purchase');
    });
  });

  describe('getReciprocityInsights', () => {
    it('should provide insights about user reciprocity patterns', async () => {
      const userId = 'user123';

      // Mock contribution history
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                { type: 'content_creation', value: 50, created_at: '2025-01-01' },
                { type: 'expertise_sharing', value: 100, created_at: '2025-01-15' },
              ],
              error: null,
            }),
          }),
        }),
      });

      // Mock benefit history
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                { benefit_type: 'purchase', value: 30, created_at: '2025-01-10' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const insights = await service.getReciprocityInsights(userId);

      expect(insights.trendDirection).toBe('increasing'); // Contributions increasing
      expect(insights.mostFrequentContribution).toBe('expertise_sharing');
      expect(insights.suggestions).toBeDefined();
    });
  });
});
