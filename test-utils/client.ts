/**
 * Test HTTP Client
 *
 * Utilities for creating test HTTP requests to the multi-tenant API.
 */

import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../api/server';

let app: Application;

/**
 * Initialize test app
 */
export const initTestApp = (): Application => {
  if (!app) {
    app = createApp();
  }
  return app;
};

/**
 * Get test app instance
 */
export const getTestApp = (): Application => {
  if (!app) {
    app = initTestApp();
  }
  return app;
};

/**
 * Create test HTTP client
 */
export const createTestClient = () => {
  const testApp = getTestApp();
  return request(testApp);
};

/**
 * Test authentication credentials
 */
export const TEST_CREDENTIALS = {
  apiKey: process.env.API_KEY_PLATFORM || 'test-api-key',
  apiKeyHugoLove: process.env.API_KEY_HUGO_LOVE || 'test-api-key-hugo-love',
  apiKeyHugoCareer: process.env.API_KEY_HUGO_CAREER || 'test-api-key-hugo-career',
  validToken: 'test-jwt-token',
  invalidToken: 'invalid-jwt-token',
};

/**
 * Test app IDs
 */
export const TEST_APP_IDS = {
  hugoLove: 'hugo_love',
  hugoCareer: 'hugo_career',
  hugoTest: 'hugo_test',
};

/**
 * Test user IDs
 */
export const TEST_USER_IDS = {
  user1: '00000000-0000-0000-0000-000000000001',
  user2: '00000000-0000-0000-0000-000000000002',
  admin: '00000000-0000-0000-0000-000000000099',
};

/**
 * Create authenticated request with API key
 */
export const withApiKey = (
  req: request.Test,
  apiKey: string = TEST_CREDENTIALS.apiKey
): request.Test => {
  return req.set('X-API-Key', apiKey);
};

/**
 * Create authenticated request with JWT token
 */
export const withAuth = (
  req: request.Test,
  token: string = TEST_CREDENTIALS.validToken
): request.Test => {
  return req.set('Authorization', `Bearer ${token}`);
};

/**
 * Create request with app context
 */
export const withAppId = (
  req: request.Test,
  appId: string = TEST_APP_IDS.hugoLove
): request.Test => {
  return req.set('X-App-ID', appId);
};

/**
 * Create fully authenticated multi-tenant request
 */
export const createAuthenticatedRequest = (
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  endpoint: string,
  options: {
    apiKey?: string;
    token?: string;
    appId?: string;
  } = {}
): request.Test => {
  const client = createTestClient();
  let req = client[method](endpoint);

  if (options.apiKey !== undefined) {
    req = withApiKey(req, options.apiKey);
  } else {
    req = withApiKey(req);
  }

  if (options.token) {
    req = withAuth(req, options.token);
  }

  if (options.appId) {
    req = withAppId(req, options.appId);
  }

  return req;
};
