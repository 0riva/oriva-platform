/**
 * AWS client construction and the not-found error shape.
 *
 * These cover the two things the aws-sdk v2 -> v3 migration could silently get
 * wrong, neither of which a type-check can see:
 *
 *  1. **Credentials.** v2 took `accessKeyId` / `secretAccessKey` at the top
 *     level; v3 nests them under `credentials`. Getting that wrong does not
 *     fail to compile — the client is simply constructed without credentials
 *     and every call is rejected at runtime.
 *
 *  2. **The not-found check.** v2 surfaced `error.code` and `error.statusCode`;
 *     v3 surfaces `error.name` and `error.$metadata.httpStatusCode`. Code that
 *     kept checking the v2 shape stops recognising a missing object and
 *     rethrows, turning an ordinary "not found" path into a 500.
 *
 * The second is the reason this file exists: it is invisible until someone
 * requests a recording that is not there.
 */

import { getS3Client, getRekognitionClient, resetAwsClients, isNotFoundError } from '../../src/services/aws/clients';

const ENV_KEYS = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  resetAwsClients();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetAwsClients();
});

describe('getS3Client', () => {
  it('defaults to us-east-1 when no region is configured', async () => {
    const region = await getS3Client().config.region();
    expect(region).toBe('us-east-1');
  });

  it('uses the configured region', async () => {
    process.env.AWS_REGION = 'eu-west-2';
    const region = await getS3Client().config.region();
    expect(region).toBe('eu-west-2');
  });

  it('passes both halves of an explicit credential through', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-example';

    const creds = await getS3Client().config.credentials();

    expect(creds.accessKeyId).toBe('AKIAEXAMPLE');
    expect(creds.secretAccessKey).toBe('secret-example');
  });

  it('does NOT use a half-supplied credential, falling through to the provider chain', async () => {
    // A half-populated credential is worse than none: the SDK would treat it as
    // explicit and stop looking, so a deployment relying on a task role breaks.
    // Either outcome below is correct — resolving something else, or resolving
    // nothing at all. What must never happen is the half value being used.
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE';

    let resolvedId: string | undefined;
    try {
      resolvedId = (await getS3Client().config.credentials()).accessKeyId;
    } catch {
      resolvedId = undefined; // no ambient credentials on this machine
    }

    expect(resolvedId).not.toBe('AKIAEXAMPLE');
  });

  it('returns the same client on repeat calls rather than building a new one', () => {
    expect(getS3Client()).toBe(getS3Client());
  });

  it('builds a fresh client after a reset', () => {
    const first = getS3Client();
    resetAwsClients();
    expect(getS3Client()).not.toBe(first);
  });
});

describe('getRekognitionClient', () => {
  it('is configured from the same region', async () => {
    process.env.AWS_REGION = 'ap-southeast-2';
    expect(await getRekognitionClient().config.region()).toBe('ap-southeast-2');
  });

  it('is memoised independently of the S3 client', () => {
    expect(getRekognitionClient()).toBe(getRekognitionClient());
  });
});

describe('isNotFoundError', () => {
  it('recognises the v3 NotFound that headObject throws', () => {
    expect(isNotFoundError({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  it('recognises NoSuchKey, which getObject throws instead', () => {
    // S3 is inconsistent about which name it uses; both must be handled or one
    // of the two call paths silently rethrows.
    expect(isNotFoundError({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  it('recognises a 404 even when the name is unfamiliar', () => {
    expect(isNotFoundError({ name: 'SomethingElse', $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  it('does not treat other failures as not-found', () => {
    expect(isNotFoundError({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).toBe(false);
    expect(isNotFoundError({ name: 'InternalError', $metadata: { httpStatusCode: 500 } })).toBe(false);
  });

  it('does not throw on values that are not errors', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError('NotFound')).toBe(false);
    expect(isNotFoundError({})).toBe(false);
  });
});
