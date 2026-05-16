/**
 * @jest-environment node
 *
 * Ported from ultra-cli; extended with new global flags (--json, --profile, --api-key).
 */
import { parseArgs } from '../src/parseArgs.js';

describe('parseArgs', () => {
  it('returns help when no args', () => {
    expect(parseArgs([])).toMatchObject({ kind: 'help' });
  });

  it('returns help on --help with no command', () => {
    expect(parseArgs(['--help'])).toMatchObject({ kind: 'help' });
    expect(parseArgs(['-h'])).toMatchObject({ kind: 'help' });
  });

  it('returns version on --version', () => {
    expect(parseArgs(['--version'])).toMatchObject({ kind: 'version' });
    expect(parseArgs(['-V'])).toMatchObject({ kind: 'version' });
  });

  it('returns command-help on `<cmd> --help`', () => {
    const r = parseArgs(['listProfiles', '--help']);
    expect(r).toMatchObject({ kind: 'command-help', command: 'listProfiles' });
  });

  it('captures bare command', () => {
    const r = parseArgs(['getCurrentUser']);
    expect(r).toMatchObject({ kind: 'command', command: 'getCurrentUser', flags: {} });
  });

  it('parses --key=value', () => {
    const r = parseArgs(['listProfiles', '--limit=25', '--filter=active']);
    expect(r.flags).toEqual({ limit: '25', filter: 'active' });
  });

  it('parses --key value (space-separated)', () => {
    const r = parseArgs(['listProfiles', '--limit', '25']);
    expect(r.flags).toEqual({ limit: '25' });
  });

  it('parses boolean flags (no value)', () => {
    const r = parseArgs(['listProfiles', '--debug']);
    expect(r.flags).toEqual({ debug: true });
  });

  it('collects repeated flags into an array', () => {
    const r = parseArgs(['listProfiles', '--tag=a', '--tag=b', '--tag=c']);
    expect(r.flags).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('parses --body=<inline json>', () => {
    const r = parseArgs(['createDeveloperApp', '--body={"name":"x"}']);
    expect(r.bodySource).toEqual({ kind: 'inline', text: '{"name":"x"}' });
  });

  it('parses --body=@file', () => {
    const r = parseArgs(['createDeveloperApp', '--body=@payload.json']);
    expect(r.bodySource).toEqual({ kind: 'file', path: 'payload.json' });
  });

  it('parses --body=- as stdin', () => {
    const r = parseArgs(['createDeveloperApp', '--body=-']);
    expect(r.bodySource).toEqual({ kind: 'stdin' });
  });

  it('peels --spec global flag from anywhere', () => {
    const before = parseArgs(['--spec=https://example/test.json', 'listProfiles']);
    expect(before.global.spec).toBe('https://example/test.json');
    expect(before.command).toBe('listProfiles');

    const after = parseArgs(['listProfiles', '--spec=https://example/test.json']);
    expect(after.global.spec).toBe('https://example/test.json');
    expect(after.command).toBe('listProfiles');
  });

  it('peels --base-url, --show-status, --raw, --json, --quiet globals', () => {
    const r = parseArgs([
      'listProfiles',
      '--base-url=http://x',
      '--show-status',
      '--raw',
      '--json',
      '--quiet',
    ]);
    expect(r.global).toEqual({
      baseUrl: 'http://x',
      showStatus: true,
      raw: true,
      json: true,
      quiet: true,
    });
  });

  it('peels --api-key and --profile globals', () => {
    const r = parseArgs(['listProfiles', '--api-key=oriva_pk_test_abc', '--profile=staging']);
    expect(r.global.apiKey).toBe('oriva_pk_test_abc');
    expect(r.global.profile).toBe('staging');
  });

  it('--show-status without value defaults to true (does not consume next token)', () => {
    const r = parseArgs(['listProfiles', '--show-status', '--limit=10']);
    expect(r.global.showStatus).toBe(true);
    expect(r.flags).toEqual({ limit: '10' });
  });

  it('throws on unexpected positional after command', () => {
    expect(() => parseArgs(['listProfiles', 'oops'])).toThrow(/Unexpected positional/);
  });
});
