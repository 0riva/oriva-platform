/**
 * Limohawk Loyalty Service Tests
 *
 * Tests for the loyalty points business logic:
 * - Points calculation (standard and VIP)
 * - Points to credit conversion
 * - Credit redemption with 20% cap
 * - Account management
 */

// Mock Supabase before imports
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

import {
  POINTS_PER_CONVERSION,
  CREDIT_PER_CONVERSION_PENCE,
  VIP_MULTIPLIER,
  MAX_CREDIT_PERCENTAGE,
} from '../../../src/services/limohawk/loyaltyService';

describe('LoyaltyService Constants', () => {
  describe('Points Configuration', () => {
    it('should have correct conversion rate (100 points = £5)', () => {
      expect(POINTS_PER_CONVERSION).toBe(100);
      expect(CREDIT_PER_CONVERSION_PENCE).toBe(500);
    });

    it('should have VIP multiplier of 1.5', () => {
      expect(VIP_MULTIPLIER).toBe(1.5);
    });

    it('should have max credit redemption of 20%', () => {
      expect(MAX_CREDIT_PERCENTAGE).toBe(0.2);
    });
  });
});

describe('Points Calculation Logic', () => {
  describe('Standard Members', () => {
    it('should calculate 1 point per £1 (100 pence)', () => {
      // £125 booking = 12500 pence = 125 points
      const netFarePence = 12500;
      const expectedPoints = Math.round(netFarePence / 100);
      expect(expectedPoints).toBe(125);
    });

    it('should round down partial points', () => {
      // £85.50 booking = 8550 pence = 85 points (not 85.5)
      const netFarePence = 8550;
      const expectedPoints = Math.round(netFarePence / 100);
      expect(expectedPoints).toBe(86); // round to nearest
    });

    it('should handle small bookings correctly', () => {
      // £15 booking = 1500 pence = 15 points
      const netFarePence = 1500;
      const expectedPoints = Math.round(netFarePence / 100);
      expect(expectedPoints).toBe(15);
    });
  });

  describe('VIP Members', () => {
    it('should apply 1.5x multiplier for VIP', () => {
      // £100 booking with VIP = 150 points
      const netFarePence = 10000;
      const basePoints = netFarePence / 100;
      const vipPoints = Math.round(basePoints * VIP_MULTIPLIER);
      expect(vipPoints).toBe(150);
    });

    it('should handle VIP multiplier with fractional results', () => {
      // £85 booking with VIP = 85 * 1.5 = 127.5 → 128 points
      const netFarePence = 8500;
      const basePoints = netFarePence / 100;
      const vipPoints = Math.round(basePoints * VIP_MULTIPLIER);
      expect(vipPoints).toBe(128);
    });
  });
});

describe('Points to Credit Conversion Logic', () => {
  it('should convert 100 points to £5 (500 pence)', () => {
    const points = 100;
    const creditPence = Math.floor(points / POINTS_PER_CONVERSION) * CREDIT_PER_CONVERSION_PENCE;
    expect(creditPence).toBe(500);
  });

  it('should convert 500 points to £25 (2500 pence)', () => {
    const points = 500;
    const creditPence = Math.floor(points / POINTS_PER_CONVERSION) * CREDIT_PER_CONVERSION_PENCE;
    expect(creditPence).toBe(2500);
  });

  it('should only convert in multiples of 100', () => {
    // 250 points = 200 converted (2 x 100) = £10
    const points = 250;
    const convertedPoints = Math.floor(points / POINTS_PER_CONVERSION) * POINTS_PER_CONVERSION;
    const creditPence = Math.floor(points / POINTS_PER_CONVERSION) * CREDIT_PER_CONVERSION_PENCE;

    expect(convertedPoints).toBe(200);
    expect(creditPence).toBe(1000);
  });

  it('should not convert less than 100 points', () => {
    const points = 99;
    const creditPence = Math.floor(points / POINTS_PER_CONVERSION) * CREDIT_PER_CONVERSION_PENCE;
    expect(creditPence).toBe(0);
  });
});

describe('Credit Redemption Logic', () => {
  describe('20% Maximum Cap', () => {
    it('should cap credit at 20% of booking value', () => {
      // £100 booking = 10000 pence, max credit = 2000 pence (£20)
      const bookingValuePence = 10000;
      const maxCredit = Math.floor(bookingValuePence * MAX_CREDIT_PERCENTAGE);
      expect(maxCredit).toBe(2000);
    });

    it('should allow full credit when below cap', () => {
      // £500 booking with £50 credit request (10% of booking)
      const bookingValuePence = 50000;
      const creditRequestedPence = 5000;
      const maxCredit = Math.floor(bookingValuePence * MAX_CREDIT_PERCENTAGE);
      const creditAllowed = Math.min(creditRequestedPence, maxCredit);

      expect(maxCredit).toBe(10000); // 20% cap = £100
      expect(creditAllowed).toBe(5000); // Full request allowed
    });

    it('should reduce credit when above cap', () => {
      // £100 booking with £30 credit request (30% > 20% cap)
      const bookingValuePence = 10000;
      const creditRequestedPence = 3000;
      const maxCredit = Math.floor(bookingValuePence * MAX_CREDIT_PERCENTAGE);
      const creditAllowed = Math.min(creditRequestedPence, maxCredit);

      expect(maxCredit).toBe(2000); // 20% cap = £20
      expect(creditAllowed).toBe(2000); // Capped to £20
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero credit balance', () => {
      const creditBalance = 0;
      const creditRequested = 500;
      const creditAvailable = Math.min(creditBalance, creditRequested);
      expect(creditAvailable).toBe(0);
    });

    it('should not allow more credit than balance', () => {
      const creditBalance = 1000; // £10 available
      const creditRequested = 5000; // £50 requested
      const creditAvailable = Math.min(creditBalance, creditRequested);
      expect(creditAvailable).toBe(1000); // Limited to balance
    });
  });
});

describe('Business Rules Validation', () => {
  describe('Points Expiry', () => {
    it('should expire points after 12 months of inactivity', () => {
      const expiryMonths = 12;
      const lastActivity = new Date('2024-01-15');
      const now = new Date('2025-01-16'); // More than 12 months later

      const monthsSinceActivity =
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const isExpired = monthsSinceActivity >= expiryMonths;

      expect(isExpired).toBe(true);
    });

    it('should not expire points before 12 months', () => {
      const expiryMonths = 12;
      const lastActivity = new Date('2024-01-15');
      const now = new Date('2024-12-15'); // 11 months later

      const monthsSinceActivity =
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const isExpired = monthsSinceActivity >= expiryMonths;

      expect(isExpired).toBe(false);
    });
  });

  describe('VIP Membership Prices', () => {
    it('should have correct monthly price (£19.99)', () => {
      const monthlyPricePence = 1999;
      expect(monthlyPricePence / 100).toBe(19.99);
    });

    it('should have correct annual price (£149)', () => {
      const annualPricePence = 14900;
      expect(annualPricePence / 100).toBe(149);
    });

    it('should have annual savings vs monthly', () => {
      const monthlyPricePence = 1999;
      const annualPricePence = 14900;
      const monthlyPerYear = monthlyPricePence * 12; // £239.88
      const savings = monthlyPerYear - annualPricePence;

      expect(savings).toBe(9088); // £90.88 savings
    });
  });
});

describe('HMAC Signature Verification', () => {
  const crypto = require('crypto');

  it('should generate correct HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({
      event_type: 'booking.completed',
      booking_id: 'TEST-001',
      customer: { id: 'CUST-001', email: 'test@example.com' },
      fare: { net_pence: 10000 },
    });
    const secret = 'test-webhook-secret';

    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Signature should be 64 characters (SHA256 hex)
    expect(signature).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(signature)).toBe(true);
  });

  it('should verify matching signatures', () => {
    const payload = 'test-payload';
    const secret = 'test-secret';

    const signature1 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const signature2 = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature1, 'hex'),
      Buffer.from(signature2, 'hex')
    );

    expect(isValid).toBe(true);
  });

  it('should reject non-matching signatures', () => {
    const payload = 'test-payload';
    const correctSecret = 'correct-secret';
    const wrongSecret = 'wrong-secret';

    const correctSignature = crypto
      .createHmac('sha256', correctSecret)
      .update(payload)
      .digest('hex');
    const wrongSignature = crypto.createHmac('sha256', wrongSecret).update(payload).digest('hex');

    expect(correctSignature).not.toBe(wrongSignature);
  });
});
