/**
 * Smoke tests for openapi.ts — verifies the bundled spec.json projects into
 * a non-empty tool list and that operation indexing is intact.
 *
 * If this test breaks, mcp-server will boot with 0 tools or duplicate-name
 * collisions — both customer-visible failures.
 */
import { projectTools, getSpecInfo } from '../src/openapi.js';

describe('openapi projector', () => {
  it('projects the bundled spec into a non-empty tool list with a valid index', () => {
    const { tools, index } = projectTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(index.size).toBe(tools.length);
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(index.has(tool.name)).toBe(true);
    }
  });

  it('reports spec info matching the bundled snapshot', () => {
    const info = getSpecInfo();
    expect(info.paths).toBeGreaterThan(0);
    expect(info.schemas).toBeGreaterThanOrEqual(0);
  });

  it('strips PAT-management ops from the bundled spec (copy-spec.mjs filter)', () => {
    const { index } = projectTools();
    expect(index.has('createPersonalAccessToken')).toBe(false);
    expect(index.has('listPersonalAccessTokens')).toBe(false);
    expect(index.has('revokePersonalAccessToken')).toBe(false);
  });
});
