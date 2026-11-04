/**
 * The API must load in a deployment with no OPENAI_API_KEY (#84).
 *
 * api/index builds the Merlin router while it loads. openai 6 throws "Missing credentials" from its
 * constructor when the key is absent, so an eagerly built client took the whole function down
 * (FUNCTION_INVOCATION_FAILED on every api/index route, 2026-11-03). The services now create the
 * client on first use; only a request that needs the model can fail.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const supabase = {} as SupabaseClient;
let saved: string | undefined;

beforeEach(() => {
  // src/lib/metrics.ts starts a cleanup interval on load; fake timers keep it from holding jest open.
  jest.useFakeTimers();
  saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  // The router's auth middleware reads these on load; placeholders, never contacted.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:1';
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
  jest.resetModules();
});
afterEach(() => {
  jest.useRealTimers();
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
});

it('builds the Merlin router, as api/index does on load, with no OpenAI key', () => {
  const { createMerlinAIRouter } = require('../../src/routes/merlin-ai');
  expect(() => createMerlinAIRouter(supabase)).not.toThrow();
});

it('builds the Hugo service with no OpenAI key', () => {
  const { HugoAIService } = require('../../src/services/hugo-ai');
  expect(() => new HugoAIService(supabase)).not.toThrow();
});

it('creates the client once a model is needed, and says what is missing', () => {
  const { MerlinAIService } = require('../../src/services/merlin-ai');
  const service = new MerlinAIService(supabase);
  expect(() => (service as unknown as { openai: unknown }).openai).toThrow(/Missing credentials|OPENAI_API_KEY/);
});
