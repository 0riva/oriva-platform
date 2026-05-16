/**
 * @jest-environment node
 *
 * End-to-end test for the CLI runner. Injects a fake OpenAPI spec + mock
 * fetch so we exercise parsing → coercion → executor wiring without HTTP.
 *
 * Ported from ultra-cli; uses Oriva fixture operationIds (camelCase) +
 * adds --json envelope assertions.
 */
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { Readable, Writable } from 'node:stream';
import { run } from '../src/cli.js';
import type { MinimalOpenApiDoc } from '../src/shared/loadSpec.js';

const SPEC: MinimalOpenApiDoc = {
  openapi: '3.1.0',
  info: { version: '1.0.0' },
  servers: [{ url: 'https://api.test/v1' }],
  paths: {
    '/profiles': {
      get: {
        operationId: 'listProfiles',
        summary: 'List profiles',
        tags: ['Profiles'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
      } as unknown,
    },
    '/developer/apps': {
      post: {
        operationId: 'createDeveloperApp',
        summary: 'Create a developer app',
        tags: ['Developer'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      } as unknown,
    },
    '/profiles/{profileId}': {
      get: {
        operationId: 'getProfile',
        summary: 'Get a profile',
        tags: ['Profiles'],
        parameters: [{ name: 'profileId', in: 'path', required: true, schema: { type: 'string' } }],
      } as unknown,
    },
    '/user/me': {
      get: {
        operationId: 'getCurrentUser',
        summary: 'Get the current user',
        tags: ['User'],
      } as unknown,
    },
  },
};

function makeStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, text: () => chunks.join('') };
}

function makeFetchMock(status: number, body: unknown, headers: Record<string, string> = {}) {
  const response = new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  return jest.fn<typeof fetch>().mockResolvedValue(response);
}

describe('cli.run', () => {
  let stdout: ReturnType<typeof makeStream>;
  let stderr: ReturnType<typeof makeStream>;

  beforeEach(() => {
    stdout = makeStream();
    stderr = makeStream();
  });

  it('prints top-level help and exits 0 when no args', async () => {
    const code = await run({
      argv: [],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    expect(stdout.text()).toContain('oriva — Oriva public API CLI');
    expect(stdout.text()).toContain('listProfiles');
    expect(stdout.text()).toContain('createDeveloperApp');
    // Tag grouping
    expect(stdout.text()).toMatch(/Developer[\s\S]*createDeveloperApp/);
    expect(stdout.text()).toMatch(/Profiles[\s\S]*listProfiles/);
  });

  it('prints command help on `<cmd> --help`', async () => {
    const code = await run({
      argv: ['listProfiles', '--help'],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    expect(stdout.text()).toContain('GET /profiles');
    expect(stdout.text()).toContain('QUERY PARAMETERS');
  });

  it('prints version on --version', async () => {
    const code = await run({
      argv: ['--version'],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    expect(stdout.text()).toMatch(/oriva 0\.1\.0/);
    expect(stdout.text()).toMatch(/spec\s+1\.0\.0/);
  });

  it('exits 3 with suggestions for unknown command', async () => {
    const code = await run({
      argv: ['listProfilez'],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      specOverride: SPEC,
    });
    expect(code).toBe(3);
    expect(stderr.text()).toMatch(/Unknown command: listProfilez/);
    expect(stderr.text()).toMatch(/Did you mean: listProfiles/);
  });

  it('dispatches GET with query params and exits 0 on 2xx', async () => {
    const fetchMock = makeFetchMock(200, { profiles: [], page: { has_more: false } });
    const code = await run({
      argv: ['listProfiles', '--limit=10', '--status=active'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/v1/profiles?limit=10&status=active');
    expect((init as { method: string }).method).toBe('GET');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer oriva_pk_test_abc'
    );
    expect(stdout.text()).toContain('"has_more": false');
  });

  it('dispatches POST with JSON body and exits 0 on 2xx', async () => {
    const fetchMock = makeFetchMock(201, { app: { id: 'app_new' } });
    const code = await run({
      argv: ['createDeveloperApp', '--body={"name":"test app"}'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as { method: string }).method).toBe('POST');
    expect((init as { headers: Record<string, string> }).headers['Content-Type']).toBe(
      'application/json'
    );
    expect(JSON.parse((init as { body: string }).body)).toEqual({ name: 'test app' });
  });

  it('reads --body=- from stdin', async () => {
    const fetchMock = makeFetchMock(201, { app: { id: 'app_new' } });
    const code = await run({
      argv: ['createDeveloperApp', '--body=-'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdin: Readable.from(['{"name":"FromStdin"}']) as unknown as NodeJS.ReadableStream,
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(code).toBe(0);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as { body: string }).body)).toEqual({ name: 'FromStdin' });
  });

  it('exits 1 on 4xx', async () => {
    const fetchMock = makeFetchMock(401, { error: { code: 'unauthenticated' } });
    const code = await run({
      argv: ['listProfiles'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(code).toBe(1);
    expect(stdout.text()).toContain('unauthenticated');
  });

  it('exits 2 on 5xx', async () => {
    const fetchMock = makeFetchMock(503, { error: { code: 'upstream_unavailable' } });
    const code = await run({
      argv: ['listProfiles'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(code).toBe(2);
  });

  it('exits 3 on missing required body', async () => {
    const code = await run({
      argv: ['createDeveloperApp'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      specOverride: SPEC,
    });
    expect(code).toBe(3);
    expect(stderr.text()).toMatch(/requires --body/);
  });

  it('warns when no API key is resolved', async () => {
    const fetchMock = makeFetchMock(200, { profiles: [] });
    await run({
      argv: ['listProfiles'],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
      configPath: '/nonexistent.json',
    });
    expect(stderr.text()).toMatch(/no API key resolved/);
  });

  it('respects --quiet (no API-key warning)', async () => {
    const fetchMock = makeFetchMock(200, { profiles: [] });
    await run({
      argv: ['listProfiles', '--quiet'],
      env: {},
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
      configPath: '/nonexistent.json',
    });
    expect(stderr.text()).not.toMatch(/no API key resolved/);
  });

  it('--show-status writes HTTP status + request_id to stderr', async () => {
    const fetchMock = makeFetchMock(200, { profiles: [] }, { 'x-request-id': 'req_ABC' });
    await run({
      argv: ['listProfiles', '--show-status'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    expect(stderr.text()).toMatch(/HTTP 200/);
    expect(stderr.text()).toMatch(/request_id=req_ABC/);
  });

  it('--base-url overrides spec servers[0]', async () => {
    const fetchMock = makeFetchMock(200, {});
    await run({
      argv: ['listProfiles', '--base-url=http://localhost:3000'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^http:\/\/localhost:3000/);
  });

  it('--api-key flag overrides ORIVA_API_KEY env', async () => {
    const fetchMock = makeFetchMock(200, {});
    await run({
      argv: ['listProfiles', '--api-key=oriva_pk_test_FLAG'],
      env: { ORIVA_API_KEY: 'oriva_pk_test_ENV' },
      stdout: stdout.stream,
      stderr: stderr.stream,
      fetchImpl: fetchMock as unknown as typeof fetch,
      specOverride: SPEC,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer oriva_pk_test_FLAG'
    );
  });

  describe('--json envelope', () => {
    it('emits { ok: true, status, data, ... } on 2xx', async () => {
      const fetchMock = makeFetchMock(200, { user: { id: 'u_1' } }, { 'x-request-id': 'req_XYZ' });
      const code = await run({
        argv: ['getCurrentUser', '--json'],
        env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
        stdout: stdout.stream,
        stderr: stderr.stream,
        fetchImpl: fetchMock as unknown as typeof fetch,
        specOverride: SPEC,
      });
      expect(code).toBe(0);
      const envelope = JSON.parse(stdout.text());
      expect(envelope.ok).toBe(true);
      expect(envelope.status).toBe(200);
      expect(envelope.data).toEqual({ user: { id: 'u_1' } });
      expect(envelope.error).toBeNull();
      expect(envelope.request_id).toBe('req_XYZ');
      expect(envelope.method).toBe('GET');
    });

    it('emits { ok: false, status, error, ... } on 4xx', async () => {
      const fetchMock = makeFetchMock(401, { error: { code: 'unauthenticated' } });
      const code = await run({
        argv: ['listProfiles', '--json'],
        env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
        stdout: stdout.stream,
        stderr: stderr.stream,
        fetchImpl: fetchMock as unknown as typeof fetch,
        specOverride: SPEC,
      });
      expect(code).toBe(1);
      const envelope = JSON.parse(stdout.text());
      expect(envelope.ok).toBe(false);
      expect(envelope.status).toBe(401);
      expect(envelope.data).toBeNull();
      expect(envelope.error).toEqual({ code: 'unauthenticated' });
    });

    it('emits envelope-shaped error on network failure (exit 2)', async () => {
      const fetchMock = jest
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('connect ECONNREFUSED'));
      const code = await run({
        argv: ['listProfiles', '--json'],
        env: { ORIVA_API_KEY: 'oriva_pk_test_abc' },
        stdout: stdout.stream,
        stderr: stderr.stream,
        fetchImpl: fetchMock as unknown as typeof fetch,
        specOverride: SPEC,
      });
      expect(code).toBe(2);
      const envelope = JSON.parse(stdout.text());
      expect(envelope.ok).toBe(false);
      expect(envelope.status).toBe(0);
      expect((envelope.error as { kind: string }).kind).toBe('network');
    });
  });
});
