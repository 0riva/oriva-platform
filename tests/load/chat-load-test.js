// Task: T078 - Load testing with k6
// Description: Simulate 100+ concurrent users, 1000 messages/minute

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const chatResponseTime = new Trend('chat_response_time');
const knowledgeSearchTime = new Trend('knowledge_search_time');
const tokenUsage = new Trend('token_usage');
const slowResponses = new Counter('slow_responses');
const rateLimitHits = new Counter('rate_limit_hits');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 50 },   // Ramp to 50 users over 2 minutes
    { duration: '3m', target: 100 },  // Ramp to 100 users over 3 minutes

    // Sustained load
    { duration: '10m', target: 100 }, // Hold 100 users for 10 minutes

    // Peak load
    { duration: '2m', target: 150 },  // Spike to 150 users
    { duration: '3m', target: 150 },  // Hold peak for 3 minutes

    // Ramp down
    { duration: '2m', target: 50 },   // Ramp down to 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],

  thresholds: {
    // Response time thresholds
    'http_req_duration': ['p(95)<1000', 'p(99)<3000'],

    // Error rate threshold
    'errors': ['rate<0.01'], // < 1% errors

    // Custom metric thresholds
    'chat_response_time': ['p(95)<3000', 'p(99)<5000'],
    'knowledge_search_time': ['avg<500', 'p(95)<1000'],

    // Success rate
    'http_req_failed': ['rate<0.05'], // < 5% failures
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const APP_ID = __ENV.APP_ID || 'hugo-matchmaker';

// Test data
const testMessages = [
  "How do I start a conversation?",
  "What's The Intimacy Code?",
  "Can you help me practice a conversation?",
  "What should I say on a first date?",
  "How do I show I'm interested without being pushy?",
  "What are good conversation topics?",
  "How do I handle awkward silences?",
  "What's a good way to ask someone out?",
  "How do I read body language?",
  "What makes a good conversation?",
];

// Helper: Get random message
function getRandomMessage() {
  return testMessages[Math.floor(Math.random() * testMessages.length)];
}

// Helper: Create authorization header
function getHeaders(userId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-App-ID': APP_ID,
  };

  if (userId) {
    headers['Authorization'] = `Bearer ${userId}`;
  }

  return headers;
}

// Test: Health check
export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check returns healthy': (r) => {
      const body = JSON.parse(r.body);
      return body.status === 'healthy';
    },
  });

  errorRate.add(res.status !== 200);
}

// Test: Create conversation
function createConversation(userId) {
  const payload = {
    app_id: APP_ID,
    title: `Load Test Conversation ${Date.now()}`,
    metadata: {
      test: true,
      load_test_run: __ENV.TEST_RUN_ID || 'unknown',
    },
  };

  const res = http.post(
    `${BASE_URL}/api/v1/conversations`,
    JSON.stringify(payload),
    { headers: getHeaders(userId), timeout: '10s' }
  );

  const success = check(res, {
    'create conversation status is 200': (r) => r.status === 200,
    'conversation has id': (r) => {
      const body = JSON.parse(r.body);
      return body.conversation && body.conversation.id;
    },
  });

  errorRate.add(!success);

  if (success) {
    const body = JSON.parse(res.body);
    return body.conversation.id;
  }

  return null;
}

// Test: Send chat message
function sendChatMessage(conversationId, userId) {
  const payload = {
    conversation_id: conversationId,
    message: getRandomMessage(),
    app_id: APP_ID,
  };

  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/hugo/chat`,
    JSON.stringify(payload),
    { headers: getHeaders(userId), timeout: '30s' }
  );
  const duration = Date.now() - startTime;

  const success = check(res, {
    'chat status is 200': (r) => r.status === 200,
    'chat returns message': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.message && body.message.content;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  chatResponseTime.add(duration);

  // Track slow responses
  if (duration > 5000) {
    slowResponses.add(1);
  }

  // Track rate limit hits
  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  // Extract token usage if available
  if (success) {
    try {
      const body = JSON.parse(res.body);
      if (body.usage && body.usage.total_tokens) {
        tokenUsage.add(body.usage.total_tokens);
      }
    } catch {
      // Ignore parsing errors
    }
  }
}

// Test: Search knowledge base
function searchKnowledge(query) {
  const payload = {
    query,
    app_id: APP_ID,
    limit: 5,
  };

  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/knowledge/search`,
    JSON.stringify(payload),
    { headers: getHeaders(), timeout: '5s' }
  );
  const duration = Date.now() - startTime;

  const success = check(res, {
    'knowledge search status is 200': (r) => r.status === 200,
    'knowledge search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  knowledgeSearchTime.add(duration);
}

// Main test scenario
export default function () {
  // Simulate a unique user
  const userId = `load-test-user-${__VU}-${__ITER}`;

  group('Chat Flow', () => {
    // Step 1: Create conversation
    const conversationId = createConversation(userId);

    if (!conversationId) {
      console.error('Failed to create conversation');
      return;
    }

    sleep(1); // Think time

    // Step 2: Send multiple messages (simulate conversation)
    const messageCount = Math.floor(Math.random() * 3) + 2; // 2-4 messages

    for (let i = 0; i < messageCount; i++) {
      sendChatMessage(conversationId, userId);
      sleep(Math.random() * 3 + 2); // 2-5 seconds think time
    }
  });

  // Occasionally search knowledge base
  if (Math.random() < 0.3) {
    group('Knowledge Search', () => {
      searchKnowledge(getRandomMessage());
      sleep(1);
    });
  }

  // Occasional health check
  if (Math.random() < 0.1) {
    group('Health Check', () => {
      healthCheck();
    });
  }

  // Random think time between iterations
  sleep(Math.random() * 5 + 5); // 5-10 seconds
}

// Setup function (runs once at start)
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`App ID: ${APP_ID}`);
  console.log(`Test Run ID: ${__ENV.TEST_RUN_ID || 'unknown'}`);

  // Verify health before starting
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error('Health check failed - cannot start load test');
  }

  return {
    startTime: Date.now(),
  };
}

// Teardown function (runs once at end)
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
}