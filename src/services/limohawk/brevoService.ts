/**
 * Brevo (Sendinblue) email service for LimoHawk loyalty notifications
 * Stub — implement when Brevo integration is wired up
 */

export async function sendExpiryWarningEmail(
  _accountId: string,
  _email: string,
  _name: string,
  _pointsBalance: number,
  _daysUntilExpiry: number
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented' };
}

export async function wasNotificationSent(
  _accountId: string,
  _type: string,
  _withinHours: number
): Promise<boolean> {
  return false;
}

export async function syncLoyaltyAccountToBrevo(_accountId: string): Promise<void> {
  // TODO: Implement Brevo contact sync
}
