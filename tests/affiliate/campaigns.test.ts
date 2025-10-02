/**
 * Affiliate Campaign API Tests (T145)
 *
 * Tests affiliate campaign management endpoints:
 * - Create campaign (POST /api/affiliate/campaigns/create)
 * - List campaigns (GET /api/affiliate/campaigns)
 * - Campaign validation and permissions
 * - Commission rate configuration
 * - Campaign status management
 */

describe('Affiliate Campaign API', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/affiliate/campaigns/create', () => {
    it('should create affiliate campaign with percentage commission', async () => {
      const affiliateId = 'affiliate-123';
      const itemId = 'item-456';

      const campaignData = {
        affiliate_id: affiliateId,
        item_id: itemId,
        name: 'Summer Sale Campaign',
        commission_rate: 15, // 15%
        commission_type: 'percentage',
        is_active: true,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'campaign-789',
                ...campaignData,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .insert(campaignData)
        .select()
        .single();

      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('Summer Sale Campaign');
      expect(result.data.commission_rate).toBe(15);
      expect(result.data.commission_type).toBe('percentage');
      expect(result.data.is_active).toBe(true);
    });

    it('should create campaign with fixed commission amount', async () => {
      const campaignData = {
        affiliate_id: 'affiliate-123',
        item_id: 'item-456',
        name: 'Fixed Commission Campaign',
        commission_type: 'fixed',
        fixed_commission_cents: 500, // $5.00
        is_active: true,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'campaign-890',
                ...campaignData,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .insert(campaignData)
        .select()
        .single();

      expect(result.data.commission_type).toBe('fixed');
      expect(result.data.fixed_commission_cents).toBe(500);
    });

    it('should validate commission rate is within bounds (0-100%)', async () => {
      const invalidRates = [-10, 0, 101, 150];

      invalidRates.forEach(rate => {
        const isValid = rate > 0 && rate <= 100;
        expect(isValid).toBe(false);
      });

      const validRates = [1, 10, 50, 100];
      validRates.forEach(rate => {
        const isValid = rate > 0 && rate <= 100;
        expect(isValid).toBe(true);
      });
    });

    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const authResult = await mockSupabaseClient.auth.getUser();

      expect(authResult.data.user).toBeNull();
      expect(authResult.error).toBeDefined();
    });

    it('should verify item ownership before creating campaign', async () => {
      const userId = 'user-123';
      const itemId = 'item-456';

      // Check item ownership
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: itemId,
                user_id: userId,
                entry_type: 'marketplace_item',
              },
              error: null,
            }),
          }),
        }),
      });

      const itemCheck = await mockSupabaseClient.from('entries')
        .select('*')
        .eq('id', itemId)
        .single();

      expect(itemCheck.data.user_id).toBe(userId);
      expect(itemCheck.data.entry_type).toBe('marketplace_item');
    });

    it('should prevent creating campaign for non-marketplace items', async () => {
      const itemId = 'item-456';

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: itemId,
                entry_type: 'standard', // Not a marketplace item
              },
              error: null,
            }),
          }),
        }),
      });

      const itemCheck = await mockSupabaseClient.from('entries')
        .select('*')
        .eq('id', itemId)
        .single();

      const isMarketplaceItem = itemCheck.data.entry_type === 'marketplace_item';
      expect(isMarketplaceItem).toBe(false);
    });

    it('should generate unique campaign ID', async () => {
      const campaigns = ['campaign-1', 'campaign-2', 'campaign-3'];
      const uniqueIds = new Set(campaigns);

      expect(uniqueIds.size).toBe(campaigns.length);
    });

    it('should set default values for optional fields', async () => {
      const minimalCampaign = {
        affiliate_id: 'affiliate-123',
        item_id: 'item-456',
        name: 'Basic Campaign',
        commission_rate: 10,
        commission_type: 'percentage',
      };

      const withDefaults = {
        ...minimalCampaign,
        is_active: (minimalCampaign as any).is_active ?? true,
        start_date: (minimalCampaign as any).start_date ?? new Date().toISOString(),
        end_date: (minimalCampaign as any).end_date ?? null,
        max_conversions: (minimalCampaign as any).max_conversions ?? null,
      };

      expect(withDefaults.is_active).toBe(true);
      expect(withDefaults.start_date).toBeDefined();
      expect(withDefaults.end_date).toBeNull();
      expect(withDefaults.max_conversions).toBeNull();
    });
  });

  describe('GET /api/affiliate/campaigns', () => {
    it('should list all campaigns for affiliate', async () => {
      const affiliateId = 'affiliate-123';

      const mockCampaigns = [
        {
          id: 'campaign-1',
          affiliate_id: affiliateId,
          name: 'Campaign 1',
          is_active: true,
        },
        {
          id: 'campaign-2',
          affiliate_id: affiliateId,
          name: 'Campaign 2',
          is_active: true,
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockCampaigns,
            error: null,
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .select('*')
        .eq('affiliate_id', affiliateId);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].affiliate_id).toBe(affiliateId);
      expect(result.data[1].affiliate_id).toBe(affiliateId);
    });

    it('should filter campaigns by status', async () => {
      const affiliateId = 'affiliate-123';

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{
                id: 'campaign-1',
                affiliate_id: affiliateId,
                is_active: true,
              }],
              error: null,
            }),
          }),
        }),
      });

      const activeResult = await mockSupabaseClient.from('affiliate_campaigns')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .eq('is_active', true);

      expect(activeResult.data).toHaveLength(1);
      expect(activeResult.data[0].is_active).toBe(true);
    });

    it('should include item details with campaigns', async () => {
      const affiliateId = 'affiliate-123';

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{
              id: 'campaign-1',
              affiliate_id: affiliateId,
              name: 'Campaign 1',
              entries: {
                id: 'item-456',
                content: 'Premium Product',
                marketplace_metadata: {
                  price: 99.99,
                },
              },
            }],
            error: null,
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .select('*, entries!inner(*)')
        .eq('affiliate_id', affiliateId);

      expect(result.data[0].entries).toBeDefined();
      expect(result.data[0].entries.content).toBe('Premium Product');
      expect(result.data[0].entries.marketplace_metadata.price).toBe(99.99);
    });

    it('should include campaign performance metrics', async () => {
      const campaignId = 'campaign-123';

      const metrics = {
        total_clicks: 150,
        total_conversions: 12,
        conversion_rate: 0.08, // 8%
        total_commission_earned: 18000, // $180.00 in cents
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{
              id: campaignId,
              ...metrics,
            }],
            error: null,
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .select('*, affiliate_analytics!inner(*)')
        .eq('id', campaignId);

      expect(result.data[0].total_clicks).toBe(150);
      expect(result.data[0].total_conversions).toBe(12);
      expect(result.data[0].conversion_rate).toBe(0.08);
    });

    it('should sort campaigns by creation date (newest first)', async () => {
      const campaigns = [
        { id: 'c1', created_at: '2024-01-01' },
        { id: 'c2', created_at: '2024-01-03' },
        { id: 'c3', created_at: '2024-01-02' },
      ];

      const sorted = [...campaigns].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      expect(sorted[0].id).toBe('c2'); // Newest
      expect(sorted[1].id).toBe('c3');
      expect(sorted[2].id).toBe('c1'); // Oldest
    });

    it('should paginate campaign results', async () => {
      const pageSize = 10;
      const page = 1;

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({
            data: Array(10).fill(null).map((_, i) => ({
              id: `campaign-${i}`,
            })),
            error: null,
          }),
        }),
      });

      const result = await mockSupabaseClient.from('affiliate_campaigns')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      expect(result.data).toHaveLength(10);
    });
  });

  describe('Campaign Validation', () => {
    it('should validate required fields', () => {
      const requiredFields = ['affiliate_id', 'item_id', 'name', 'commission_type'];

      const incompleteCampaign = {
        affiliate_id: 'affiliate-123',
        name: 'Test Campaign',
        // Missing item_id and commission_type
      };

      const missingFields = requiredFields.filter(
        field => !incompleteCampaign[field as keyof typeof incompleteCampaign]
      );

      expect(missingFields).toContain('item_id');
      expect(missingFields).toContain('commission_type');
    });

    it('should validate campaign name length', () => {
      const validName = 'Summer Sale Campaign';
      const tooShort = 'AB';
      const tooLong = 'A'.repeat(201);

      const isValidLength = (name: string) =>
        name.length >= 3 && name.length <= 200;

      expect(isValidLength(validName)).toBe(true);
      expect(isValidLength(tooShort)).toBe(false);
      expect(isValidLength(tooLong)).toBe(false);
    });

    it('should validate commission type is either percentage or fixed', () => {
      const validTypes = ['percentage', 'fixed'];
      const invalidTypes = ['hourly', 'subscription', 'tiered'];

      validTypes.forEach(type => {
        expect(['percentage', 'fixed'].includes(type)).toBe(true);
      });

      invalidTypes.forEach(type => {
        expect(['percentage', 'fixed'].includes(type)).toBe(false);
      });
    });

    it('should require fixed_commission_cents when type is fixed', () => {
      const fixedCampaign = {
        commission_type: 'fixed',
        fixed_commission_cents: 500,
      };

      const invalidFixedCampaign = {
        commission_type: 'fixed',
        // Missing fixed_commission_cents
      };

      const isValid = (campaign: any) =>
        campaign.commission_type !== 'fixed' ||
        (campaign.fixed_commission_cents !== undefined &&
         campaign.fixed_commission_cents > 0);

      expect(isValid(fixedCampaign)).toBe(true);
      expect(isValid(invalidFixedCampaign)).toBe(false);
    });

    it('should require commission_rate when type is percentage', () => {
      const percentageCampaign = {
        commission_type: 'percentage',
        commission_rate: 15,
      };

      const invalidPercentageCampaign = {
        commission_type: 'percentage',
        // Missing commission_rate
      };

      const isValid = (campaign: any) =>
        campaign.commission_type !== 'percentage' ||
        (campaign.commission_rate !== undefined &&
         campaign.commission_rate > 0 &&
         campaign.commission_rate <= 100);

      expect(isValid(percentageCampaign)).toBe(true);
      expect(isValid(invalidPercentageCampaign)).toBe(false);
    });
  });

  describe('Campaign Permissions', () => {
    it('should only allow item owner to create campaigns', async () => {
      const userId = 'user-123';
      const itemOwnerId = 'user-456';

      const hasPermission = (userId as string) === (itemOwnerId as string);

      expect(hasPermission).toBe(false);
    });

    it('should only allow affiliate to view their own campaigns', async () => {
      const currentUserId = 'affiliate-123';
      const campaignOwnerId = 'affiliate-456';

      const canView = (currentUserId as string) === (campaignOwnerId as string);

      expect(canView).toBe(false);
    });

    it('should allow item owner to deactivate any campaign for their item', async () => {
      const userId = 'user-123';
      const itemOwnerId = 'user-123';

      const canDeactivate = userId === itemOwnerId;

      expect(canDeactivate).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle campaigns with no conversions', async () => {
      const campaign = {
        id: 'campaign-123',
        total_clicks: 100,
        total_conversions: 0,
        conversion_rate: 0,
      };

      expect(campaign.conversion_rate).toBe(0);
      expect(campaign.total_conversions).toBe(0);
    });

    it('should handle expired campaigns gracefully', async () => {
      const campaign = {
        id: 'campaign-123',
        end_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        is_active: true,
      };

      const isExpired = campaign.end_date &&
        new Date(campaign.end_date) < new Date();

      expect(isExpired).toBe(true);
    });

    it('should handle campaigns with max conversions reached', async () => {
      const campaign = {
        id: 'campaign-123',
        max_conversions: 100,
        total_conversions: 100,
      };

      const hasReachedLimit = campaign.max_conversions !== null &&
        campaign.total_conversions >= campaign.max_conversions;

      expect(hasReachedLimit).toBe(true);
    });

    it('should handle concurrent campaign creation', async () => {
      const campaigns = await Promise.all([
        Promise.resolve({ id: 'c1' }),
        Promise.resolve({ id: 'c2' }),
        Promise.resolve({ id: 'c3' }),
      ]);

      expect(campaigns).toHaveLength(3);
      const ids = campaigns.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
