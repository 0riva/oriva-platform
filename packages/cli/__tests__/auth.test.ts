/**
 * @jest-environment node
 *
 * Auth precedence: flag > env > config-file profile (named OR active OR default).
 */
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { resolveAuth } from '../src/auth.js';

const TMP = resolve(tmpdir(), `oriva-cli-auth-${Date.now()}-${process.pid}`);
const CFG = resolve(TMP, 'config.json');

async function writeCfg(content: object) {
  await mkdir(TMP, { recursive: true });
  await writeFile(CFG, JSON.stringify(content));
}

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe('resolveAuth', () => {
  it('flag wins over env', async () => {
    const r = await resolveAuth({
      flagApiKey: 'oriva_pk_test_FLAG',
      envApiKey: 'oriva_pk_test_ENV',
      configPath: '/nonexistent.json',
    });
    expect(r.apiKey).toBe('oriva_pk_test_FLAG');
    expect(r.source).toBe('flag');
  });

  it('env wins over config-file', async () => {
    await writeCfg({ profiles: { default: { apiKey: 'oriva_pk_test_CFG' } } });
    const r = await resolveAuth({
      envApiKey: 'oriva_pk_test_ENV',
      configPath: CFG,
    });
    expect(r.apiKey).toBe('oriva_pk_test_ENV');
    expect(r.source).toBe('env');
  });

  it('reads activeProfile from config when flag + env unset', async () => {
    await writeCfg({
      activeProfile: 'staging',
      profiles: {
        default: { apiKey: 'oriva_pk_test_DEFAULT' },
        staging: { apiKey: 'oriva_pk_test_STAGING', baseUrl: 'https://staging.api.oriva.io' },
      },
    });
    const r = await resolveAuth({ configPath: CFG });
    expect(r.apiKey).toBe('oriva_pk_test_STAGING');
    expect(r.baseUrl).toBe('https://staging.api.oriva.io');
    expect(r.source).toBe('config:staging');
  });

  it('--profile flag overrides activeProfile', async () => {
    await writeCfg({
      activeProfile: 'staging',
      profiles: {
        default: { apiKey: 'oriva_pk_test_DEFAULT' },
        staging: { apiKey: 'oriva_pk_test_STAGING' },
      },
    });
    const r = await resolveAuth({ profile: 'default', configPath: CFG });
    expect(r.apiKey).toBe('oriva_pk_test_DEFAULT');
    expect(r.source).toBe('config:default');
  });

  it('falls back to "default" profile when activeProfile unset', async () => {
    await writeCfg({ profiles: { default: { apiKey: 'oriva_pk_test_X' } } });
    const r = await resolveAuth({ configPath: CFG });
    expect(r.apiKey).toBe('oriva_pk_test_X');
  });

  it('returns source:none when nothing resolves', async () => {
    const r = await resolveAuth({ configPath: '/definitely/not/here.json' });
    expect(r.apiKey).toBeUndefined();
    expect(r.source).toBe('none');
  });

  it('handles unreadable / malformed config file as none', async () => {
    await mkdir(TMP, { recursive: true });
    await writeFile(CFG, '{not valid json');
    const r = await resolveAuth({ configPath: CFG });
    expect(r.source).toBe('none');
  });
});
