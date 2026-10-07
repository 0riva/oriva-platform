/**
 * callOperation for the agent tools (o-platform#76): MCP tool arguments are
 * split into body fields and header flags, and the Idempotency-Key the CLI
 * used comes back so index.ts can report it to the agent.
 */
import { jest } from '@jest/globals';
import type { CliCallArgs, CliRunOptions, CliRunResult } from '../src/cliRunner.js';

const runCliMock = jest.fn<(call: CliCallArgs, options: CliRunOptions) => Promise<CliRunResult>>();

jest.unstable_mockModule('../src/cliRunner.js', () => ({
  runCli: runCliMock,
  resolveCliBin: () => '/dev/null/oriva',
}));

const { callOperation } = await import('../src/client.js');
const { projectTools } = await import('../src/openapi.js');

const apiKey = 'oriva_pk_test_abcdef0123456789';
const LISTING_ID = '11111111-2222-4333-8444-555555555555';
const buyListing = projectTools().index.get('buyListing')!;

beforeEach(() => {
  runCliMock.mockReset();
});

it('puts listing fields in the body and the idempotency key in header flags', async () => {
  runCliMock.mockResolvedValue({
    status: 201,
    ok: true,
    text: '{"purchase":{"id":"p1"}}',
    envelope: {
      ok: true,
      status: 201,
      data: { purchase: { id: 'p1' } },
      error: null,
      idempotency_key: 'order-42',
    },
  });
  const result = await callOperation(
    buyListing,
    {
      listingId: LISTING_ID,
      expectedAmountCents: 1200,
      variantIndex: 1,
      idempotencyKey: 'order-42',
    },
    { apiKey }
  );
  const [call] = runCliMock.mock.calls[0]!;
  expect(call.toolName).toBe('buyListing');
  expect(call.body).toEqual({ listingId: LISTING_ID, expectedAmountCents: 1200, variantIndex: 1 });
  expect(call.headerParams).toEqual({ idempotencyKey: 'order-42' });
  expect(result).toEqual({
    status: 201,
    ok: true,
    text: '{"purchase":{"id":"p1"}}',
    idempotencyKey: 'order-42',
  });
});

it('sends no idempotency flag when the agent gives none, and reports the one the CLI generated', async () => {
  runCliMock.mockResolvedValue({
    status: 202,
    ok: true,
    text: '{"pending":true}',
    envelope: {
      ok: true,
      status: 202,
      data: { pending: true },
      error: null,
      idempotency_key: 'generated-uuid',
    },
  });
  const result = await callOperation(
    buyListing,
    { listingId: LISTING_ID, expectedAmountCents: 1200 },
    { apiKey }
  );
  const [call] = runCliMock.mock.calls[0]!;
  expect(call.headerParams).toEqual({});
  expect(call.body).toEqual({ listingId: LISTING_ID, expectedAmountCents: 1200 });
  expect(result.idempotencyKey).toBe('generated-uuid');
  expect(result.status).toBe(202);
});
