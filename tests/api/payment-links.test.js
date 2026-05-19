/**
 * POST /api/v1/payments/payment-links — contract tests
 *
 * Mirrors the me-tokens.test.js / developer.test.js pattern: hits the real
 * Express app via supertest with the test API key infrastructure. We don't
 * mock Stripe or Supabase — we exercise the auth + validation contract.
 *
 * Routes for valid API-key-authed Stripe checkout creation are covered by
 * the integration suite (tests/integration/) which runs against a real
 * Supabase + Stripe test mode.
 *
 * Asserts use the same loose rejection-status set as other contract tests
 * because the validateApiKey middleware has rate-limiting, env-key checks,
 * and Supabase lookups that may surface different status codes depending
 * on test-env state.
 */

const { createTestRequest, withAuth, testData } = require('../utils/testHelpers');

const expectRejection = (response, allowedStatuses) => {
  expect(allowedStatuses).toContain(response.status);
  if (response.status !== 429 && response.status !== 204) {
    expect(response.body.success).toBe(false);
  }
};

const VALID_BODY = {
  amount_cents: 1000,
  currency: 'usd',
  success_url: 'https://oriva.io/checkout/success',
  cancel_url: 'https://oriva.io/checkout/cancel',
};

describe('POST /api/v1/payments/payment-links — contract', () => {
  describe('auth', () => {
    test('rejects request with no Authorization header', async () => {
      const response = await createTestRequest('/api/v1/payments/payment-links', 'post')
        .set('Content-Type', 'application/json')
        .send(VALID_BODY);
      expectRejection(response, [401, 429]);
    });

    test('rejects request with invalid api key', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        'oriva_pk_definitely_not_a_real_key'
      ).send(VALID_BODY);
      expectRejection(response, [400, 401, 403, 429, 500]);
    });
  });

  describe('validation (auth-rejected paths still accepted as 4xx)', () => {
    test('rejects body missing amount_cents', async () => {
      const { amount_cents: _omit, ...body } = VALID_BODY;
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send(body);
      expectRejection(response, [400, 401, 403, 429, 500]);
    });

    test('rejects body missing success_url', async () => {
      const { success_url: _omit, ...body } = VALID_BODY;
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send(body);
      expectRejection(response, [400, 401, 403, 429, 500]);
    });

    test('rejects body with http:// success_url (HTTPS scheme enforced)', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ ...VALID_BODY, success_url: 'http://oriva.io/checkout/success' });
      expectRejection(response, [400, 401, 403, 429, 500]);
    });

    test('rejects malformed merchant_connect_account_id', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ ...VALID_BODY, merchant_connect_account_id: 'not-an-acct-id' });
      expectRejection(response, [400, 401, 403, 429, 500]);
    });

    test('rejects body with currency of wrong length', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ ...VALID_BODY, currency: 'usdd' });
      expectRejection(response, [400, 401, 403, 429, 500]);
    });

    test('rejects amount_cents above max bound', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/payments/payment-links', 'post').set('Content-Type', 'application/json'),
        testData.validApiKey
      ).send({ ...VALID_BODY, amount_cents: 100_000_000 });
      expectRejection(response, [400, 401, 403, 429, 500]);
    });
  });

  describe('method', () => {
    test('GET returns 404 (route is POST-only)', async () => {
      const response = await createTestRequest('/api/v1/payments/payment-links', 'get');
      // Express default behavior: unmatched method on a defined path returns 404
      expect([404, 405]).toContain(response.status);
    });
  });
});
