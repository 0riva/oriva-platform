#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { callOperation } from './client.js';
import { getSpecInfo, projectTools } from './openapi.js';
import { getActiveManifestForTool, emitInvokeSkillEvent } from './reaEmitter.js';

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

  // --- REA invoke-skill emission (OQ-10: only when active manifest exists) ---
  let invocationId: string | undefined;
  try {
    const manifest = await getActiveManifestForTool(op.toolName, apiKey);
    if (manifest) {
      invocationId = crypto.randomUUID();
      // Fire-and-forget — do not await; do not let emission failure surface to the agent.
      emitInvokeSkillEvent(
        {
          manifest_id: manifest.id,
          invocation_id: invocationId,
          mcp_tool_name: op.toolName,
          agent_principal_id: null, // Phase 1: agent identity not yet threaded through API key context
        },
        apiKey
      ).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[oriva-mcp] background invoke-skill emission error: ${message}\n`);
      });
    }
  } catch (err) {
    // Manifest lookup errors must never block the tool call.
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[oriva-mcp] manifest lookup error for "${op.toolName}": ${message}\n`);
  }
  // -------------------------------------------------------------------------

  try {
    const args = request.params.arguments ?? {};
    // Thread the invocation_id into request args so tool logic can include it
    // in payment-link metadata (T-09). The field is prefixed to avoid collision
    // with OpenAPI-defined body fields.
    const enrichedArgs = invocationId ? { ...args, _oriva_invocation_id: invocationId } : args;

    const result = await callOperation(op, enrichedArgs, { apiKey });
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
