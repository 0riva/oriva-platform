/**
 * AWS client construction — single place, so credentials and region are
 * configured once rather than in each route.
 *
 * Migrated from aws-sdk v2 (2026-08-15). v2 is in maintenance and carried the
 * last two advisories left after the dependency sweep; v3 is modular, so we
 * pull only S3 and Rekognition rather than the whole bundle.
 *
 * Two shape changes worth knowing when reading call sites:
 *
 *  - Credentials move from top-level `accessKeyId` / `secretAccessKey` into a
 *    nested `credentials` object.
 *  - `signatureVersion: 'v4'` is gone. v4 is the only thing v3 signs with, so
 *    the option no longer exists rather than having changed meaning.
 *
 * Credentials are read from the environment when present, and otherwise left
 * to the default provider chain — which is what lets the same code work from a
 * task role in deployment without static keys.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { RekognitionClient } from '@aws-sdk/client-rekognition';

const region = (): string => process.env.AWS_REGION || 'us-east-1';

/**
 * Static credentials if both halves are set, otherwise undefined so the SDK
 * falls back to its default provider chain. Returning a half-populated object
 * would be worse than returning nothing: the SDK would treat it as an explicit
 * credential and stop looking.
 */
const explicitCredentials = ():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey };
};

let s3Client: S3Client | undefined;
let rekognitionClient: RekognitionClient | undefined;

/** Shared S3 client. Constructed once; safe to call from module scope. */
export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({ region: region(), credentials: explicitCredentials() });
  }
  return s3Client;
};

/** Shared Rekognition client, used for image moderation. */
export const getRekognitionClient = (): RekognitionClient => {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: region(),
      credentials: explicitCredentials(),
    });
  }
  return rekognitionClient;
};

/**
 * Drop the memoised clients. Exists for tests, which need to observe the
 * effect of different environments on construction.
 */
export const resetAwsClients = (): void => {
  s3Client = undefined;
  rekognitionClient = undefined;
};

/**
 * Whether an AWS error means "the object is not there".
 *
 * This is the one behavioural trap in the v2 -> v3 move. v2 surfaced
 * `error.code === 'NotFound'` and `error.statusCode === 404`; v3 surfaces
 * `error.name` and `error.$metadata.httpStatusCode`. Code that kept checking
 * the v2 shape would stop recognising a missing object and rethrow instead of
 * handling it — turning a normal "not found" path into an unhandled error.
 *
 * S3 is also inconsistent about which name it uses: `headObject` answers
 * `NotFound`, while `getObject` answers `NoSuchKey`. Both are accepted here.
 */
export const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (e.name === 'NotFound' || e.name === 'NoSuchKey') return true;
  if (e.Code === 'NotFound' || e.Code === 'NoSuchKey') return true;
  return e.$metadata?.httpStatusCode === 404;
};
