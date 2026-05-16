#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { callOperation } from './client.js';
import { getSpecInfo, projectTools } from './openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  name: string;
  version: string;
};
const PKG_NAME = pkg.name;
const PKG_VERSION = pkg.version;

function fail(message: string): never {
  process.stderr.write(`[oriva-mcp] ${message}\n`);
  process.exit(1);
}

const apiKey = process.env.ORIVA_API_KEY;
if (!apiKey) {
  fail(
    'ORIVA_API_KEY environment variable is required.\n' +
      '         Get a key from https://api.oriva.io/developer and run with:\n' +
      '           ORIVA_API_KEY=oriva_pk_xxx oriva-mcp'
  );
}

let projection: ReturnType<typeof projectTools>;
try {
  projection = projectTools();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  fail(`Failed to project OpenAPI spec into MCP tools: ${message}`);
}

const { tools, index } = projection;
const info = getSpecInfo();
process.stderr.write(
  `[oriva-mcp] Loaded ${tools.length} tools from spec (${info.paths} paths, ${info.schemas} schemas).\n`
);

const server = new Server(
  { name: PKG_NAME, version: PKG_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const op = index.get(request.params.name);
  if (!op) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }
  try {
    const result = await callOperation(op, request.params.arguments ?? {}, { apiKey });
    const prefix = result.ok ? '' : `HTTP ${result.status}\n`;
    return {
      content: [{ type: 'text', text: `${prefix}${result.text}` }],
      isError: !result.ok,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[oriva-mcp] Connected via stdio.\n');
