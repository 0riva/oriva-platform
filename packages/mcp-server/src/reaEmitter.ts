/**
 * Tiny HTTP client for emitting REA (Resources/Events/Agents) events to o-core.
 *
 * Design:
 *   - No external dependencies — uses native `fetch` (Node 18+)
 *   - No @oriva/shared or Supabase SDK (keeps mcp-server lean per OQ-7)
 *   - Fire-and-forget: caller awaits emitInvokeSkillEvent() but the function
 *     itself does NOT block the tool-call response on network availability.
 *   - Per-session in-memory manifest cache: avoids a manifest lookup HTTP
 *     round-trip on every tool call after the first lookup for a given toolName.
 *
 * Auth: uses ORIVA_API_KEY (same env var the mcp-server requires for operation).
 * Endpoint: {ORIVA_API_BASE_URL}/api/v1/rea/events (o-core REA event endpoint).
 */

const DEFAULT_BASE_URL = 'https://api.oriva.io';

/** Shape of a single manifest row returned by the manifest list endpoint. */
export interface ActiveManifest {
  id: string;
  mcp_tool_name: string;
  revenue_share_bps: number;
  status: 'active';
}

/** Cached manifest lookup results keyed by tool name. */
const manifestCache = new Map<string, ActiveManifest | null>();

/**
 * Query o-core for the active manifest for a given MCP tool name.
 * Returns the first active manifest, or null if none exists.
 * Results are cached for the lifetime of the mcp-server process.
 */
export async function getActiveManifestForTool(
  toolName: string,
  apiKey: string,
  baseUrl?: string
): Promise<ActiveManifest | null> {
  if (manifestCache.has(toolName)) {
    return manifestCache.get(toolName) ?? null;
  }

  const base = baseUrl ?? process.env.ORIVA_API_BASE_URL ?? DEFAULT_BASE_URL;
  const url = `${base}/api/v1/skills/manifests?tool_name=${encodeURIComponent(toolName)}&status=active`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Non-2xx — treat as "no manifest" rather than crashing the tool call.
      process.stderr.write(
        `[oriva-mcp] manifest lookup for "${toolName}" returned HTTP ${response.status} — skipping REA emission.\n`
      );
      manifestCache.set(toolName, null);
      return null;
    }

    // Expected shape: { data: ActiveManifest[] } or ActiveManifest[]
    const body = (await response.json()) as { data?: ActiveManifest[] } | ActiveManifest[];
    const items: ActiveManifest[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: ActiveManifest[] }).data)
        ? (body as { data: ActiveManifest[] }).data
        : [];

    const manifest = items.length > 0 ? items[0] : null;
    manifestCache.set(toolName, manifest);
    return manifest;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[oriva-mcp] manifest lookup for "${toolName}" failed: ${message} — skipping REA emission.\n`
    );
    manifestCache.set(toolName, null);
    return null;
  }
}

/** Payload for an invoke-skill REA event. */
export interface InvokeSkillEventPayload {
  manifest_id: string;
  invocation_id: string;
  mcp_tool_name: string;
  /** Agent principal derived from the API key context, if available. */
  agent_principal_id: string | null;
}

/**
 * Emit an `invoke-skill` REA event to o-core.
 * Fire-and-forget: errors are logged to stderr but do NOT propagate to the caller.
 * This must NOT block or throw — the tool-call response must not depend on it.
 */
export async function emitInvokeSkillEvent(
  payload: InvokeSkillEventPayload,
  apiKey: string,
  baseUrl?: string
): Promise<void> {
  const base = baseUrl ?? process.env.ORIVA_API_BASE_URL ?? DEFAULT_BASE_URL;
  const url = `${base}/api/v1/rea/events`;

  const body = JSON.stringify({
    action: 'invoke-skill',
    metadata: {
      manifest_id: payload.manifest_id,
      invocation_id: payload.invocation_id,
      mcp_tool_name: payload.mcp_tool_name,
      agent_principal_id: payload.agent_principal_id,
    },
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      process.stderr.write(
        `[oriva-mcp] invoke-skill event emission failed: HTTP ${response.status}\n`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[oriva-mcp] invoke-skill event emission error: ${message}\n`);
  }
}

/**
 * Clear the manifest cache. Exposed for testing — not called in production.
 */
export function clearManifestCache(): void {
  manifestCache.clear();
}
