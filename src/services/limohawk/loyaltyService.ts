/**
 * LimoHawk Loyalty Points Service
 * Stub — implement when loyalty point system is wired up
 */

interface ListAccountsParams {
  limit: number;
  offset: number;
  search?: string;
}

interface ListAccountsResult {
  accounts: Array<Record<string, unknown>>;
  total: number;
}

interface TransactionHistoryParams {
  limit: number;
  offset: number;
  type?: string;
}

interface TransactionHistoryResult {
  transactions: Array<Record<string, unknown>>;
  total: number;
}

interface ConvertResult {
  success: boolean;
  error?: string;
  creditPence?: number;
  newPointsBalance?: number;
  newCreditBalance?: number;
}

interface RedeemParams {
  bookingId: string;
  bookingValuePence: number;
  creditRequestedPence: number;
}

interface RedeemResult {
  success: boolean;
  error?: string;
  redemptionId?: string;
  creditAppliedPence?: number;
  newCreditBalance?: number;
}

interface AdjustParams {
  accountId: string;
  pointsAmount: number;
  reason: string;
  performedBy: string;
}

interface AdjustResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  transactionId?: string;
}

interface ExpiryResult {
  accountsExpired: number;
  pointsExpired: number;
}

export const loyaltyService = {
  async listAccounts(_params: ListAccountsParams): Promise<ListAccountsResult> {
    return { accounts: [], total: 0 };
  },

  async getAccount(_accountId: string): Promise<Record<string, unknown> | null> {
    return null;
  },

  async getAccountBalance(_accountId: string): Promise<number> {
    return 0;
  },

  async getAccountSummary(_accountId: string): Promise<Record<string, unknown>> {
    return {};
  },

  async getTransactionHistory(
    _accountId: string,
    _params: TransactionHistoryParams
  ): Promise<TransactionHistoryResult> {
    return { transactions: [], total: 0 };
  },

  async convertPointsToCredit(_accountId: string, _points: number): Promise<ConvertResult> {
    return { success: false, error: 'Not implemented' };
  },

  async redeemCredit(_accountId: string, _params: RedeemParams): Promise<RedeemResult> {
    return { success: false, error: 'Not implemented' };
  },

  async awardPoints(_accountId: string, _points: number, _reason: string): Promise<void> {
    // TODO: Implement points award
  },

  async redeemPoints(_accountId: string, _points: number): Promise<boolean> {
    return false;
  },

  async adminAdjustPoints(_params: AdjustParams): Promise<AdjustResult> {
    return { success: false, error: 'Not implemented' };
  },

  async triggerExpiry(): Promise<ExpiryResult> {
    return { accountsExpired: 0, pointsExpired: 0 };
  },

  async getAccountsExpiringSoon(_daysUntilExpiry: number): Promise<Array<Record<string, unknown>>> {
    return [];
  },
};
