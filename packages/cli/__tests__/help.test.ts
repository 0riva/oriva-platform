/**
 * @jest-environment node
 *
 * Ported from ultra-cli; rebuilt for camelCase command names + tag-grouped help.
 */
import { renderTopLevelHelp, renderCommandHelp, renderVersion } from '../src/help.js';
import type { ExtractedOperation } from '../src/shared/types.js';

const LIST_PROFILES: ExtractedOperation = {
  name: 'listProfiles',
  description: 'List profiles for the calling user',
  method: 'get',
  pathTemplate: '/api/v1/profiles',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', description: 'Page size (1-100)' },
      status: { type: 'string', enum: ['active', 'archived'] },
    },
  },
  pathParams: [],
  queryParams: ['limit', 'status'],
  hasBody: false,
  tags: ['Profiles'],
};

const GET_PROFILE: ExtractedOperation = {
  name: 'getProfile',
  description: 'Get a profile',
  method: 'get',
  pathTemplate: '/api/v1/profiles/{profileId}',
  inputSchema: {
    type: 'object',
    properties: { profileId: { type: 'string', description: 'Profile ID' } },
    required: ['profileId'],
  },
  pathParams: ['profileId'],
  queryParams: [],
  hasBody: false,
  tags: ['Profiles'],
};

const CREATE_DEVELOPER_APP: ExtractedOperation = {
  name: 'createDeveloperApp',
  description: 'Create a developer app',
  method: 'post',
  pathTemplate: '/api/v1/developer/apps',
  inputSchema: {
    type: 'object',
    properties: { body: { type: 'object' } },
    required: ['body'],
  },
  pathParams: [],
  queryParams: [],
  hasBody: true,
  bodyContentType: 'application/json',
  tags: ['Developer'],
};

describe('renderTopLevelHelp', () => {
  it('shows env vars + global flags', () => {
    const out = renderTopLevelHelp([LIST_PROFILES]);
    expect(out).toContain('ORIVA_API_KEY');
    expect(out).toContain('--spec=<url|path>');
    expect(out).toContain('--json');
    expect(out).toContain('--profile=<name>');
  });

  it('groups commands by OpenAPI tag', () => {
    const out = renderTopLevelHelp([LIST_PROFILES, GET_PROFILE, CREATE_DEVELOPER_APP]);
    expect(out).toMatch(/Developer[\s\S]*createDeveloperApp/);
    expect(out).toMatch(/Profiles[\s\S]*listProfiles/);
    expect(out).toMatch(/Profiles[\s\S]*getProfile/);
  });

  it('falls back to "misc" group when tags are missing', () => {
    const op: ExtractedOperation = { ...LIST_PROFILES, tags: [] };
    const out = renderTopLevelHelp([op]);
    expect(out).toContain('misc');
  });

  it('handles empty operations gracefully', () => {
    expect(renderTopLevelHelp([])).toContain('no operations available');
  });
});

describe('renderCommandHelp', () => {
  it('shows path + method + description', () => {
    const out = renderCommandHelp(LIST_PROFILES);
    expect(out).toContain('GET /api/v1/profiles');
    expect(out).toContain('List profiles for the calling user');
    expect(out).toContain('tags: Profiles');
  });

  it('lists query parameters with their types', () => {
    const out = renderCommandHelp(LIST_PROFILES);
    expect(out).toContain('QUERY PARAMETERS');
    expect(out).toContain('--limit <integer>');
    expect(out).toContain('Page size (1-100)');
    expect(out).toContain('[active|archived]');
  });

  it('marks path parameters as required', () => {
    const out = renderCommandHelp(GET_PROFILE);
    expect(out).toContain('PATH PARAMETERS (required)');
    expect(out).toContain('--profileId <string>');
  });

  it('documents --body for POST operations', () => {
    const out = renderCommandHelp(CREATE_DEVELOPER_APP);
    expect(out).toContain('REQUEST BODY');
    expect(out).toContain('--body=<json>');
    expect(out).toContain('Content-Type: application/json');
    expect(out).toContain('(required)');
  });

  it('renders an example invocation', () => {
    const out = renderCommandHelp(GET_PROFILE);
    expect(out).toContain('EXAMPLE');
    expect(out).toContain('oriva getProfile --profileId=<profileId>');
  });
});

describe('renderVersion', () => {
  it('shows CLI and spec versions', () => {
    expect(renderVersion('0.1.0', '1.0.0')).toBe('oriva 0.1.0\nspec  1.0.0');
  });

  it('falls back to "(unknown)" when spec version is undefined', () => {
    expect(renderVersion('0.1.0', undefined)).toContain('(unknown)');
  });
});
