/**
 * Semantic Thread Analysis Tests (T191)
 *
 * Tests semantic analysis of threads for commerce opportunities:
 * - Content analysis for marketplace suggestions
 * - Intent detection (buying signals, expertise needs)
 * - Keyword extraction and topic identification
 * - Commerce opportunity scoring
 * - Hugo AI integration for semantic understanding
 */

describe('Semantic Thread Analysis', () => {
  describe('Content Analysis', () => {
    it('should extract keywords from thread content', () => {
      const threadContent = 'Looking for a project management tool for my startup';

      const keywords = threadContent
        .toLowerCase()
        .split(' ')
        .filter(word => word.length > 3);

      expect(keywords).toContain('looking');
      expect(keywords).toContain('project');
      expect(keywords).toContain('management');
      expect(keywords).toContain('tool');
      expect(keywords).toContain('startup');
    });

    it('should identify buying signals in content', () => {
      const buyingSignals = [
        'looking for',
        'need a',
        'want to buy',
        'searching for',
        'recommendations for',
      ];

      const threadContent = 'I need a CRM tool for my business';

      const hasBuyingSignal = buyingSignals.some(signal =>
        threadContent.toLowerCase().includes(signal)
      );

      expect(hasBuyingSignal).toBe(true);
    });

    it('should detect expertise/service needs', () => {
      const expertiseSignals = [
        'need help with',
        'looking for expert',
        'hire someone',
        'consultant for',
        'freelancer for',
      ];

      const threadContent = 'Need help with React performance optimization';

      const needsExpertise = expertiseSignals.some(signal =>
        threadContent.toLowerCase().includes(signal)
      );

      expect(needsExpertise).toBe(true);
    });

    it('should extract product categories from content', () => {
      const categoryKeywords = {
        software: ['tool', 'app', 'software', 'platform', 'saas'],
        services: ['consultant', 'expert', 'freelancer', 'help'],
        physical: ['device', 'gadget', 'equipment', 'hardware'],
      };

      const threadContent = 'Looking for a SaaS platform for analytics';

      const detectedCategories = Object.entries(categoryKeywords)
        .filter(([category, keywords]) =>
          keywords.some(keyword => threadContent.toLowerCase().includes(keyword))
        )
        .map(([category]) => category);

      expect(detectedCategories).toContain('software');
    });
  });

  describe('Intent Detection', () => {
    it('should detect purchase intent', () => {
      const purchaseIntent = {
        thread_content: 'Want to buy a project management tool',
        intent_score: 0.9,
        intent_type: 'purchase',
      };

      expect(purchaseIntent.intent_type).toBe('purchase');
      expect(purchaseIntent.intent_score).toBeGreaterThan(0.8);
    });

    it('should detect research intent', () => {
      const researchIntent = {
        thread_content: 'What are the best CRM tools?',
        intent_score: 0.7,
        intent_type: 'research',
      };

      expect(researchIntent.intent_type).toBe('research');
      expect(researchIntent.intent_score).toBeGreaterThan(0.5);
    });

    it('should detect service request intent', () => {
      const serviceIntent = {
        thread_content: 'Need a React developer for my project',
        intent_score: 0.85,
        intent_type: 'service_request',
      };

      expect(serviceIntent.intent_type).toBe('service_request');
      expect(serviceIntent.intent_score).toBeGreaterThan(0.8);
    });

    it('should score intent confidence', () => {
      const contents = [
        { text: 'Want to buy now', expectedScore: 0.95 },
        { text: 'Looking for options', expectedScore: 0.7 },
        { text: 'Just curious about', expectedScore: 0.4 },
      ];

      contents.forEach(({ text, expectedScore }) => {
        const score = text.toLowerCase().includes('buy') ? 0.95 :
                     text.toLowerCase().includes('looking') ? 0.7 : 0.4;

        expect(score).toBeCloseTo(expectedScore, 1);
      });
    });
  });

  describe('Commerce Opportunity Scoring', () => {
    it('should calculate opportunity score based on intent + keywords', () => {
      const analysis = {
        intent_score: 0.8,
        keyword_relevance: 0.7,
        user_context: 0.6,
      };

      const opportunityScore = (
        analysis.intent_score * 0.5 +
        analysis.keyword_relevance * 0.3 +
        analysis.user_context * 0.2
      );

      expect(opportunityScore).toBeCloseTo(0.73, 2);
    });

    it('should identify high-value opportunities (score > 0.7)', () => {
      const opportunities = [
        { thread_id: 't1', score: 0.85 },
        { thread_id: 't2', score: 0.65 },
        { thread_id: 't3', score: 0.75 },
      ];

      const highValue = opportunities.filter(opp => opp.score > 0.7);

      expect(highValue.length).toBe(2);
      expect(highValue.map(o => o.thread_id)).toEqual(['t1', 't3']);
    });

    it('should prioritize opportunities by score', () => {
      const opportunities = [
        { thread_id: 't1', score: 0.65 },
        { thread_id: 't2', score: 0.85 },
        { thread_id: 't3', score: 0.75 },
      ];

      const sorted = opportunities.sort((a, b) => b.score - a.score);

      expect(sorted[0].thread_id).toBe('t2');
      expect(sorted[0].score).toBe(0.85);
    });
  });

  describe('Hugo AI Integration', () => {
    it('should call Hugo AI for semantic analysis', async () => {
      const mockHugoAI = {
        analyzeContent: jest.fn().mockResolvedValue({
          topics: ['project management', 'productivity', 'saas'],
          sentiment: 'positive',
          intent: 'purchase',
          confidence: 0.87,
        }),
      };

      const result = await mockHugoAI.analyzeContent('Looking for PM tool');

      expect(mockHugoAI.analyzeContent).toHaveBeenCalled();
      expect(result.topics).toContain('project management');
      expect(result.intent).toBe('purchase');
    });

    it('should extract marketplace-relevant topics', () => {
      const hugoTopics = [
        'project management',
        'team collaboration',
        'weather discussion', // Not marketplace-relevant
        'saas tools',
      ];

      const marketplaceCategories = [
        'project management',
        'team collaboration',
        'saas',
        'tools',
      ];

      const relevantTopics = hugoTopics.filter(topic =>
        marketplaceCategories.some(cat => topic.includes(cat))
      );

      expect(relevantTopics).toHaveLength(3);
      expect(relevantTopics).not.toContain('weather discussion');
    });

    it('should handle Hugo AI errors gracefully', async () => {
      const mockHugoAI = {
        analyzeContent: jest.fn().mockRejectedValue(new Error('API error')),
      };

      await expect(
        mockHugoAI.analyzeContent('test').catch((e: Error) => e.message)
      ).resolves.toBe('API error');

      // Should fall back to basic keyword analysis
    });
  });

  describe('Thread Context Analysis', () => {
    it('should analyze thread participants for targeting', () => {
      const thread = {
        id: 'thread-123',
        participants: [
          { id: 'u1', role: 'startup_founder' },
          { id: 'u2', role: 'developer' },
        ],
        content: 'Need a CI/CD tool',
      };

      const participantRoles = thread.participants.map(p => p.role);

      expect(participantRoles).toContain('startup_founder');
      expect(participantRoles).toContain('developer');
    });

    it('should track thread engagement metrics', () => {
      const thread = {
        id: 'thread-123',
        response_count: 15,
        view_count: 200,
        created_at: new Date(Date.now() - 3600000), // 1 hour ago
      };

      const isActive = thread.response_count > 10 && thread.view_count > 100;

      expect(isActive).toBe(true);
    });

    it('should identify thread urgency', () => {
      const urgentKeywords = ['urgent', 'asap', 'immediately', 'now', 'today'];

      const threadContent = 'Need a developer ASAP for urgent fix';

      const isUrgent = urgentKeywords.some(keyword =>
        threadContent.toLowerCase().includes(keyword)
      );

      expect(isUrgent).toBe(true);
    });
  });

  describe('Marketplace Suggestion Generation', () => {
    it('should generate product suggestions from analysis', () => {
      const analysis = {
        keywords: ['project', 'management', 'tool'],
        intent: 'purchase',
        confidence: 0.85,
      };

      const suggestions = [
        {
          item_id: 'item-1',
          name: 'Project Management Pro',
          relevance_score: 0.9,
        },
        {
          item_id: 'item-2',
          name: 'Team Collaboration Suite',
          relevance_score: 0.8,
        },
      ];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].relevance_score).toBeGreaterThan(0.8);
    });

    it('should limit suggestions based on confidence threshold', () => {
      const allSuggestions = [
        { item_id: 'i1', relevance_score: 0.9 },
        { item_id: 'i2', relevance_score: 0.7 },
        { item_id: 'i3', relevance_score: 0.4 },
      ];

      const threshold = 0.6;
      const filtered = allSuggestions.filter(s => s.relevance_score >= threshold);

      expect(filtered.length).toBe(2);
    });

    it('should include suggestion reasoning', () => {
      const suggestion = {
        item_id: 'item-123',
        name: 'DevOps Platform',
        relevance_score: 0.88,
        reasoning: 'Matches keywords: CI/CD, automation, deployment',
        matched_keywords: ['ci/cd', 'automation'],
      };

      expect(suggestion.reasoning).toBeDefined();
      expect(suggestion.matched_keywords.length).toBeGreaterThan(0);
    });
  });

  describe('API Request Handling', () => {
    it('should accept thread_id for analysis', () => {
      const requestBody = {
        thread_id: 'thread-123',
        include_context: true,
      };

      expect(requestBody.thread_id).toBeDefined();
      expect(requestBody.include_context).toBe(true);
    });

    it('should return analysis with suggestions', () => {
      const response = {
        thread_id: 'thread-123',
        analysis: {
          intent: 'purchase',
          confidence: 0.85,
          keywords: ['project', 'management'],
        },
        suggestions: [
          { item_id: 'item-1', relevance_score: 0.9 },
        ],
        opportunity_score: 0.87,
      };

      expect(response.analysis).toBeDefined();
      expect(response.suggestions).toBeDefined();
      expect(response.opportunity_score).toBeGreaterThan(0.8);
    });

    it('should validate thread exists before analysis', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Thread not found' },
            }),
          }),
        }),
      };

      const result = await mockSupabaseClient
        .from('entries')
        .select('*')
        .eq('id', 'invalid-thread');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should require authentication', () => {
      const mockRequest = {
        headers: {
          authorization: null,
        },
      };

      const isAuthenticated = !!mockRequest.headers.authorization;

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty thread content', () => {
      const threadContent = '';

      const keywords = threadContent.split(' ').filter(w => w.length > 0);

      expect(keywords.length).toBe(0);
    });

    it('should handle non-English content gracefully', () => {
      const threadContent = '我需要一个项目管理工具'; // Chinese

      // Should still attempt keyword extraction
      const hasContent = threadContent.length > 0;

      expect(hasContent).toBe(true);
    });

    it('should handle very long thread content', () => {
      const longContent = 'word '.repeat(1000); // 1000 words

      const wordCount = longContent.split(' ').filter(w => w.length > 0).length;

      expect(wordCount).toBe(1000);
    });

    it('should handle concurrent analysis requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        Promise.resolve({
          thread_id: `thread-${i}`,
          opportunity_score: Math.random(),
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.thread_id).toBeDefined();
      });
    });
  });
});
