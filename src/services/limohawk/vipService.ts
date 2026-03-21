/**
 * LimoHawk VIP Tier Service
 * Stub — implement when VIP tier system is wired up
 */

interface VipStatus {
  isVip: boolean;
  tier: string;
  expiresAt?: string;
}

interface StartSubscriptionParams {
  accountId: string;
  externalCustomerId: string;
  email: string;
  plan: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
}

interface StartSubscriptionResult {
  success: boolean;
  error?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

interface CancelResult {
  success: boolean;
  error?: string;
}

interface PortalResult {
  success: boolean;
  error?: string;
  portalUrl?: string;
}

export const vipService = {
  async getVipTier(_accountId: string): Promise<string> {
    return 'standard';
  },

  async getVipStatus(_accountId: string): Promise<VipStatus> {
    return { isVip: false, tier: 'standard' };
  },

  async getVipStatusByCustomerId(_customerId: string): Promise<VipStatus> {
    return { isVip: false, tier: 'standard' };
  },

  async checkEligibility(_accountId: string, _tier: string): Promise<boolean> {
    return false;
  },

  async upgradeTier(_accountId: string, _newTier: string): Promise<void> {
    // TODO: Implement tier upgrade
  },

  async startVipSubscription(_params: StartSubscriptionParams): Promise<StartSubscriptionResult> {
    return { success: false, error: 'Not implemented' };
  },

  async cancelVipSubscription(
    _accountId: string,
    _cancelAtPeriodEnd: boolean
  ): Promise<CancelResult> {
    return { success: false, error: 'Not implemented' };
  },

  async getCustomerPortalUrl(_accountId: string, _returnUrl: string): Promise<PortalResult> {
    return { success: false, error: 'Not implemented' };
  },

  async getMembership(_accountId: string): Promise<Record<string, unknown> | null> {
    return null;
  },

  async getMembershipHistory(
    _accountId: string,
    _limit: number
  ): Promise<Array<Record<string, unknown>>> {
    return [];
  },
};
