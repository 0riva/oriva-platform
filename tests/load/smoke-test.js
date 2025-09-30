// Task: T078 - Smoke test for quick validation
// Description: Quick test to verify basic functionality before full load test

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Minimal load for smoke testing
export const options = {
  vus: 5,               // 5 virtual users
  duration: '2m',       // 2 minutes
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'errors': ['rate<0.05'],
    'http_req_failed': ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const APP_ID = __ENV.APP_ID || 'hugo-matchmaker';

export default function () {
  const userId = `smoke-test-user-${__VU}`;

  // Test 1: Health check
  let res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'health status is 200': (r) => r.status === 200,
  });
  errorRate.add(res.status !== 200);
  sleep(1);

  // Test 2: Create conversation
  res = http.post(
    `${BASE_URL}/api/v1/conversations`,
    JSON.stringify({
      app_id: APP_ID,
      title: 'Smoke Test',
      metadata: { test: true },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}`,
        'X-App-ID': APP_ID,
      },
    }
  );

  const success = check(res, {
    'create conversation status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);

  if (success) {
    const body = JSON.parse(res.body);
    const conversationId = body.conversation.id;

    sleep(1);

    // Test 3: Send chat message
    res = http.post(
      `${BASE_URL}/api/v1/hugo/chat`,
      JSON.stringify({
        conversation_id: conversationId,
        message: 'Test message',
        app_id: APP_ID,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`,
          'X-App-ID': APP_ID,
        },
        timeout: '30s',
      }
    );

    check(res, {
      'chat status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  }

  sleep(2);
}

export function setup() {
  console.log('Starting smoke test...');
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error('Health check failed');
  }
}