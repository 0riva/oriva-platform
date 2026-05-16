/**
 * Tests for client.ts — translates a ProjectedOperation + args into a runCli call.
 *
 * Strategy: mock the cliRunner module so we can assert exactly what payload
 * the client builds from a given (op, args) pair. This is independent of the
 * subprocess plumbing (covered in cliRunner.test.ts).
 */
import { jest } from '@jest/globals';

// jest.unstable_mockModule must run BEFORE the dynamic import of the SUT.
import type { CliCallArgs, CliRunOptions } from '../src/cliRunner.js';
interface CliRunnerResult {
  status: number;
  ok: boolean;
  text: string;
  envelope: {
    ok: boolean;
    status: number;
    data: unknown;
    error: unknown;
    request_id?: string | null;
  };
}
const runCliMock = jest.fn<(call: CliCallArgs, options: CliRunOptions) => Promise<CliRunnerResult>>(
  async () => ({
    status: 200,
    ok: true,
    text: '{"id":"x"}',
    envelope: { ok: true, status: 200, data: { id: 'x' }, error: null },
  })
);

jest.unstable_mockModule('../src/cliRunner.js', () => ({
  runCli: runCliMock,
  resolveCliBin: () => '/dev/null/oriva',
}));

const { callOperation } = await import('../src/client.js');
import type { ProjectedOperation } from '../src/types.js';

const apiKey = 'oriva_pk_test_abcdef0123456789';

beforeEach(() => {
  runCliMock.mockClear();
});

describe('callOperation', () => {
  it('picks path + query params out of args and passes them under the right buckets', async () => {
    const op: ProjectedOperation = {
      toolName: 'listProfileEvents',
      path: '/profiles/{profileId}/events',
      method: 'get',
      pathParams: ['profileId'],
      queryParams: ['limit', 'cursor'],
      bodyFields: [],
    };

    await callOperation(
      op,
      { profileId: 'p_1', limit: 25, cursor: 'c_abc', extraIgnored: 'nope' },
      { apiKey }
    );

    expect(runCliMock).toHaveBeenCalledTimes(1);
    const [call, options] = runCliMock.mock.calls[0]! as unknown as [
      Parameters<typeof runCliMock>[0],
      Parameters<typeof runCliMock>[1],
    ];
    expect(call.toolName).toBe('listProfileEvents');
    expect(call.pathParams).toEqual({ profileId: 'p_1' });
    expect(call.queryParams).toEqual({ limit: 25, cursor: 'c_abc' });
    expect(call.body).toEqual({}); // no body fields declared
    expect(options.apiKey).toBe(apiKey);
    expect(options.baseUrl).toBeUndefined(); // default base URL collapses to undefined
  });

  it('reconstructs body from aliased fields when names collide with params', async () => {
    // Simulate openapi.ts having aliased a body field `name` to `body_name`
    // because a query param `name` already occupied that slot.
    const op: ProjectedOperation = {
      toolName: 'createTrip',
      path: '/trips',
      method: 'post',
      pathParams: [],
      queryParams: ['name'],
      bodyFields: [
        { alias: 'body_name', original: 'name' },
        { alias: 'description', original: 'description' },
      ],
    };

    await callOperation(
      op,
      { name: 'query-filter', body_name: 'Body Trip', description: 'A test trip' },
      { apiKey }
    );

    const [call] = runCliMock.mock.calls[0]! as unknown as [Parameters<typeof runCliMock>[0]];
    expect(call.queryParams).toEqual({ name: 'query-filter' });
    expect(call.body).toEqual({ name: 'Body Trip', description: 'A test trip' });
  });

  it('forwards a non-default baseUrl explicitly; default collapses to undefined', async () => {
    const op: ProjectedOperation = {
      toolName: 'whoami',
      path: '/me',
      method: 'get',
      pathParams: [],
      queryParams: [],
      bodyFields: [],
    };

    await callOperation(op, {}, { apiKey, baseUrl: 'https://staging.api.oriva.io' });
    const [, options] = runCliMock.mock.calls[0]! as unknown as [
      Parameters<typeof runCliMock>[0],
      Parameters<typeof runCliMock>[1],
    ];
    expect(options.baseUrl).toBe('https://staging.api.oriva.io');
  });

  it('returns {status, text, ok} from the runner envelope', async () => {
    runCliMock.mockResolvedValueOnce({
      status: 404,
      ok: false,
      text: '{"code":"NOT_FOUND"}',
      envelope: {
        ok: false,
        status: 404,
        data: null,
        error: { code: 'NOT_FOUND' },
      },
    });

    const op: ProjectedOperation = {
      toolName: 'getProfile',
      path: '/profiles/{profileId}',
      method: 'get',
      pathParams: ['profileId'],
      queryParams: [],
      bodyFields: [],
    };

    const result = await callOperation(op, { profileId: 'p_missing' }, { apiKey });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.text).toBe('{"code":"NOT_FOUND"}');
  });

  it('omits body when no body fields are defined', async () => {
    const op: ProjectedOperation = {
      toolName: 'getProfile',
      path: '/profiles/{profileId}',
      method: 'get',
      pathParams: ['profileId'],
      queryParams: [],
      bodyFields: [],
    };

    await callOperation(op, { profileId: 'p_1' }, { apiKey });
    const [call] = runCliMock.mock.calls[0]! as unknown as [Parameters<typeof runCliMock>[0]];
    // Empty body object is fine — cliRunner checks Object.keys(body).length > 0
    // before sending --body=-, so an empty body == no body.
    expect(call.body).toEqual({});
  });

  it('skips undefined arg values rather than serializing them', async () => {
    const op: ProjectedOperation = {
      toolName: 'listEvents',
      path: '/events',
      method: 'get',
      pathParams: [],
      queryParams: ['cursor', 'limit', 'tag'],
      bodyFields: [],
    };

    await callOperation(op, { cursor: 'c_1', limit: undefined, tag: undefined }, { apiKey });
    const [call] = runCliMock.mock.calls[0]! as unknown as [Parameters<typeof runCliMock>[0]];
    expect(call.queryParams).toEqual({ cursor: 'c_1' });
  });
});
