/**
 * Tests for cliRunner.ts — the subprocess shim around the `oriva` CLI.
 *
 * We mock child_process.spawn rather than exec the real CLI, because:
 *   1. The CLI's behavior is tested in @oriva/cli's own suite
 *   2. Spawning real binaries from Jest under ESM is fragile across Node versions
 *   3. We want to exercise envelope-parsing edge cases (empty stdout, bad JSON,
 *      various exit codes) deterministically
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { runCli, type CliEnvelope } from '../src/cliRunner.js';

/** Build a fake ChildProcess that emits the given stdout/stderr and exits with `code`. */
function fakeChild(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  spawnError?: Error;
}): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  ee.stdout = Readable.from(opts.stdout ? [Buffer.from(opts.stdout)] : []);
  ee.stderr = Readable.from(opts.stderr ? [Buffer.from(opts.stderr)] : []);
  // Writable that swallows stdin writes so the runner's body-pipe path doesn't throw.
  ee.stdin = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  }) as ChildProcess['stdin'];

  // Emit error then close on next tick so listeners attach first.
  setImmediate(() => {
    if (opts.spawnError) {
      ee.emit('error', opts.spawnError);
      return;
    }
    ee.emit('close', opts.exitCode ?? 0);
  });
  return ee;
}

const dummyBin = '/dev/null/oriva';
const apiKey = 'oriva_pk_test_abcdef0123456789';

describe('runCli', () => {
  it('parses a successful 200 envelope into {ok:true, status, text}', async () => {
    const envelope: CliEnvelope = {
      ok: true,
      status: 200,
      data: { profileId: 'p_1', name: 'Hugo' },
      error: null,
      request_id: 'req_abc',
    };
    const spawnMock = jest.fn(() =>
      fakeChild({ stdout: JSON.stringify(envelope), exitCode: 0 })
    ) as unknown as typeof import('node:child_process').spawn;

    const result = await runCli(
      { toolName: 'getProfile', pathParams: { profileId: 'p_1' }, queryParams: {} },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.text).toBe(JSON.stringify(envelope.data));
    expect(result.envelope.request_id).toBe('req_abc');
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = (spawnMock as unknown as jest.Mock).mock.calls[0][1] as string[];
    expect(args[0]).toBe('getProfile');
    expect(args).toContain('--json');
    expect(args).toContain(`--api-key=${apiKey}`);
    expect(args).toContain('--profileId=p_1');
  });

  it('parses a 404 envelope as {ok:false} without throwing', async () => {
    const envelope: CliEnvelope = {
      ok: false,
      status: 404,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Profile not found' },
    };
    const spawnMock = jest.fn(() =>
      fakeChild({ stdout: JSON.stringify(envelope), exitCode: 1 })
    ) as unknown as typeof import('node:child_process').spawn;

    const result = await runCli(
      { toolName: 'getProfile', pathParams: { profileId: 'p_missing' }, queryParams: {} },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.text).toBe(JSON.stringify(envelope.error));
  });

  it('forwards body via stdin when present and passes --body=-', async () => {
    let stdinPayload = '';
    const ee = new EventEmitter() as ChildProcess;
    ee.stdout = Readable.from([
      Buffer.from(JSON.stringify({ ok: true, status: 201, data: { id: 'new' }, error: null })),
    ]);
    ee.stderr = Readable.from([]);
    ee.stdin = new Writable({
      write(chunk, _enc, cb) {
        stdinPayload += chunk.toString('utf8');
        cb();
      },
    }) as ChildProcess['stdin'];
    setImmediate(() => ee.emit('close', 0));

    const spawnMock = jest.fn(() => ee) as unknown as typeof import('node:child_process').spawn;

    const body = { displayName: 'New User', email: 'u@example.com' };
    const result = await runCli(
      { toolName: 'createUser', pathParams: {}, queryParams: {}, body },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );

    expect(result.status).toBe(201);
    expect(stdinPayload).toBe(JSON.stringify(body));
    const args = (spawnMock as unknown as jest.Mock).mock.calls[0][1] as string[];
    expect(args).toContain('--body=-');
  });

  it('serializes repeated array flags into multiple --key=v invocations', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({
        stdout: JSON.stringify({ ok: true, status: 200, data: [], error: null }),
        exitCode: 0,
      })
    ) as unknown as typeof import('node:child_process').spawn;

    await runCli(
      {
        toolName: 'listEvents',
        pathParams: {},
        queryParams: { tag: ['a', 'b', 'c'] },
      },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );

    const args = (spawnMock as unknown as jest.Mock).mock.calls[0][1] as string[];
    expect(args.filter((a) => a.startsWith('--tag='))).toEqual(['--tag=a', '--tag=b', '--tag=c']);
  });

  it('passes --base-url when provided', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({
        stdout: JSON.stringify({ ok: true, status: 200, data: {}, error: null }),
        exitCode: 0,
      })
    ) as unknown as typeof import('node:child_process').spawn;

    await runCli(
      { toolName: 'whoami', pathParams: {}, queryParams: {} },
      {
        apiKey,
        binPath: dummyBin,
        baseUrl: 'https://staging.api.oriva.io',
        spawnImpl: spawnMock,
      }
    );

    const args = (spawnMock as unknown as jest.Mock).mock.calls[0][1] as string[];
    expect(args).toContain('--base-url=https://staging.api.oriva.io');
  });

  it('rejects with stderr text when CLI exits with usage error (code 3)', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({ stderr: 'Argument error: missing required path parameter\n', exitCode: 3 })
    ) as unknown as typeof import('node:child_process').spawn;

    await expect(
      runCli(
        { toolName: 'getProfile', pathParams: {}, queryParams: {} },
        { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
      )
    ).rejects.toThrow(/oriva CLI rejected request \(exit 3\)/);
  });

  it('rejects when CLI exits with spec-load failure (code 4)', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({ stderr: 'Failed to load spec\n', exitCode: 4 })
    ) as unknown as typeof import('node:child_process').spawn;

    await expect(
      runCli(
        { toolName: 'getProfile', pathParams: {}, queryParams: {} },
        { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
      )
    ).rejects.toThrow(/oriva CLI rejected request \(exit 4\)/);
  });

  it('rejects when stdout is not valid JSON', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({ stdout: 'this is not json', exitCode: 0 })
    ) as unknown as typeof import('node:child_process').spawn;

    await expect(
      runCli(
        { toolName: 'getProfile', pathParams: {}, queryParams: {} },
        { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
      )
    ).rejects.toThrow(/Failed to parse oriva CLI envelope/);
  });

  it('rejects when stdout is empty', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({ stdout: '', exitCode: 0 })
    ) as unknown as typeof import('node:child_process').spawn;

    await expect(
      runCli(
        { toolName: 'getProfile', pathParams: {}, queryParams: {} },
        { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
      )
    ).rejects.toThrow(/empty stdout/);
  });

  it('rejects when spawn itself emits an error (binary not found)', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({ spawnError: new Error('ENOENT: command not found') })
    ) as unknown as typeof import('node:child_process').spawn;

    await expect(
      runCli(
        { toolName: 'getProfile', pathParams: {}, queryParams: {} },
        { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
      )
    ).rejects.toThrow(/Failed to spawn oriva CLI: ENOENT/);
  });

  it('returns empty text when envelope data is null', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({
        stdout: JSON.stringify({ ok: true, status: 204, data: null, error: null }),
        exitCode: 0,
      })
    ) as unknown as typeof import('node:child_process').spawn;

    const result = await runCli(
      { toolName: 'deleteProfile', pathParams: { profileId: 'p_1' }, queryParams: {} },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );
    expect(result.text).toBe('');
  });

  it('returns plain string text when envelope data is a string', async () => {
    const spawnMock = jest.fn(() =>
      fakeChild({
        stdout: JSON.stringify({ ok: true, status: 200, data: 'plain text body', error: null }),
        exitCode: 0,
      })
    ) as unknown as typeof import('node:child_process').spawn;

    const result = await runCli(
      { toolName: 'getHealth', pathParams: {}, queryParams: {} },
      { apiKey, binPath: dummyBin, spawnImpl: spawnMock }
    );
    expect(result.text).toBe('plain text body');
  });
});
