/**
 * Resolve a --body source (inline JSON, file path, stdin) to a parsed value.
 * Returns undefined if no body was provided.
 *
 * Ported verbatim from ultra-cli (~/ultra-network/packages/ultra-cli/src/readBody.ts).
 */
import { readFile } from 'node:fs/promises';
import type { ParsedArgs } from './parseArgs.js';

export async function readBody(
  bodySource: ParsedArgs['bodySource'],
  stdin: NodeJS.ReadableStream = process.stdin
): Promise<unknown> {
  if (!bodySource) return undefined;
  let text: string;
  if (bodySource.kind === 'inline') {
    text = bodySource.text;
  } else if (bodySource.kind === 'file') {
    text = await readFile(bodySource.path, 'utf8');
  } else {
    text = await collectStream(stdin);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`--body is not valid JSON: ${msg}`);
  }
}

async function collectStream(s: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of s) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
