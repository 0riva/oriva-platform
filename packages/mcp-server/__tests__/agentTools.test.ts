/**
 * Agent-commerce tools (o-platform#76): buyListing, createListing,
 * listAgentPurchases — projected from the REAL bundled spec (src/spec.json,
 * copied from claudedocs/ by the jest global setup) and dispatched through
 * the CLI shim with a fake spawn.
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { projectTools, headerArgName } from '../src/openapi.js';
import { runCli, type CliEnvelope } from '../src/cliRunner.js';

const apiKey = 'oriva_pk_test_abcdef0123456789';
const LISTING_ID = '11111111-2222-4333-8444-555555555555';

function fakeChild(stdout: string, exitCode = 0): { child: ChildProcess; stdin: string[] } {
  const stdin: string[] = [];
  const ee = new EventEmitter() as ChildProcess;
  ee.stdout = Readable.from([Buffer.from(stdout)]);
  ee.stderr = Readable.from([]);
  ee.stdin = new Writable({
    write(chunk, _enc, cb) {
      stdin.push(chunk.toString());
      cb();
    },
  }) as ChildProcess['stdin'];
  setImmediate(() => ee.emit('close', exitCode));
  return { child: ee, stdin };
}

function spawnReturning(envelope: CliEnvelope, exitCode = 0) {
  let stdin: string[] = [];
  const spawnMock = jest.fn(() => {
    const f = fakeChild(JSON.stringify(envelope), exitCode);
    stdin = f.stdin;
    return f.child;
  });
  return {
    spawnImpl: spawnMock as unknown as typeof import('node:child_process').spawn,
    argv: () => (spawnMock.mock.calls[0] as unknown as [string, string[]])[1],
    stdin: () => stdin.join(''),
  };
}

describe('agent tool projection', () => {
  const { tools, index } = projectTools();
  const tool = (name: string) => {
    const t = tools.find((x) => x.name === name);
    if (!t) throw new Error(`tool ${name} missing from the projected spec`);
    return t;
  };

  it('exposes buyListing, createListing and listAgentPurchases', () => {
    for (const name of ['buyListing', 'createListing', 'listAgentPurchases']) {
      expect(index.has(name)).toBe(true);
    }
  });

  it('tells the agent what buying costs and how to behave on each answer', () => {
    const d = tool('buyListing').description;
    expect(d).toMatch(/REAL money/);
    expect(d).toContain('https://oriva.io/settings/agent-buying');
    expect(d).toMatch(/limits/);
    expect(d).toMatch(/`expectedAmountCents` must be the exact current total/);
    expect(d).toMatch(/Always send an `Idempotency-Key`/);
    expect(d).toMatch(/403 `refused: true` is final/);
    expect(d).toMatch(/do not retry/);
    expect(d).toMatch(/202 not finished yet[^\n]*do NOT buy again/);
    expect(d).toMatch(/listAgentPurchases/);
  });

  it('buyListing takes listingId + expectedAmountCents (required), variantIndex and idempotencyKey', () => {
    const s = tool('buyListing').inputSchema;
    expect(Object.keys(s.properties ?? {}).sort()).toEqual(
      ['expectedAmountCents', 'idempotencyKey', 'listingId', 'variantIndex'].sort()
    );
    expect([...(s.required ?? [])].sort()).toEqual(['expectedAmountCents', 'listingId']);
    expect(s.properties?.expectedAmountCents?.type).toBe('integer');
    expect(s.properties?.idempotencyKey?.description).toMatch(/reuse it when retrying/);
    expect(index.get('buyListing')?.headerParams).toEqual([
      { arg: 'idempotencyKey', flag: 'idempotencyKey' },
    ]);
  });

  it('createListing takes the listing fields and no Idempotency-Key', () => {
    const s = tool('createListing').inputSchema;
    expect(Object.keys(s.properties ?? {}).sort()).toEqual(
      ['currency', 'description', 'itemType', 'price', 'profileId', 'publish', 'title'].sort()
    );
    expect([...(s.required ?? [])].sort()).toEqual(['description', 'price', 'title']);
    expect(index.get('createListing')?.headerParams).toEqual([]);
    expect(tool('createListing').description).toMatch(/422/);
  });

  it('listAgentPurchases takes no input', () => {
    expect(tool('listAgentPurchases').inputSchema.properties).toEqual({});
  });

  it('header flag names match the CLI flag (`Idempotency-Key` → `idempotencyKey`)', () => {
    expect(headerArgName('Idempotency-Key')).toBe('idempotencyKey');
  });
});

describe('agent tools through the CLI shim', () => {
  it('sends the idempotency key as --idempotencyKey and the body on stdin', async () => {
    const s = spawnReturning({
      ok: true,
      status: 201,
      data: { purchase: { id: 'p1', orderId: 'o1' } },
      error: null,
      idempotency_key: 'order-42',
    });
    const result = await runCli(
      {
        toolName: 'buyListing',
        pathParams: {},
        queryParams: {},
        headerParams: { idempotencyKey: 'order-42' },
        body: { listingId: LISTING_ID, expectedAmountCents: 1200 },
      },
      { apiKey, binPath: '/dev/null/oriva', spawnImpl: s.spawnImpl }
    );
    expect(s.argv()[0]).toBe('buyListing');
    expect(s.argv()).toContain('--idempotencyKey=order-42');
    expect(s.argv()).toContain('--body=-');
    expect(JSON.parse(s.stdin())).toEqual({ listingId: LISTING_ID, expectedAmountCents: 1200 });
    expect(result.ok).toBe(true);
    expect(result.envelope.idempotency_key).toBe('order-42');
  });

  it('keeps `refused: true` in the text of a 403 so the agent knows not to retry', async () => {
    const s = spawnReturning(
      {
        ok: false,
        status: 403,
        data: null,
        error: 'Over the daily limit.',
        details: { refused: true, purchaseId: 'p1' },
      },
      1
    );
    const result = await runCli(
      { toolName: 'buyListing', pathParams: {}, queryParams: {}, body: { listingId: LISTING_ID } },
      { apiKey, binPath: '/dev/null/oriva', spawnImpl: s.spawnImpl }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(JSON.parse(result.text)).toEqual({
      error: 'Over the daily limit.',
      refused: true,
      purchaseId: 'p1',
    });
  });

  it("keeps a 422's hint for createListing", async () => {
    const s = spawnReturning(
      {
        ok: false,
        status: 422,
        data: null,
        error: 'Failed the content check.',
        details: { hint: 'Remove the phone number.' },
      },
      1
    );
    const result = await runCli(
      { toolName: 'createListing', pathParams: {}, queryParams: {}, body: { title: 't' } },
      { apiKey, binPath: '/dev/null/oriva', spawnImpl: s.spawnImpl }
    );
    expect(JSON.parse(result.text)).toEqual({
      error: 'Failed the content check.',
      hint: 'Remove the phone number.',
    });
  });

  it('a plain error with no details stays the bare error (unchanged behaviour)', async () => {
    const s = spawnReturning({ ok: false, status: 401, data: null, error: 'Bad token.' }, 1);
    const result = await runCli(
      { toolName: 'listAgentPurchases', pathParams: {}, queryParams: {} },
      { apiKey, binPath: '/dev/null/oriva', spawnImpl: s.spawnImpl }
    );
    expect(result.text).toBe('Bad token.');
    expect(s.argv().some((a) => a.startsWith('--idempotencyKey'))).toBe(false);
  });
});
