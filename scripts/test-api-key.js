const request = require('supertest');
const { createApp } = require('../api/server');

process.env.API_KEY_PLATFORM = 'test-api-key';

const app = createApp();

async function test() {
  console.log('\nAPI_KEY_PLATFORM:', process.env.API_KEY_PLATFORM);

  const response = await request(app)
    .get('/api/v1/platform/users/00000000-0000-0000-0000-000000000002/apps')
    .set('X-API-Key', 'test-api-key');

  console.log('\nStatus:', response.status);
  console.log('Body:', JSON.stringify(response.body, null, 2));
}

test().catch(console.error);
