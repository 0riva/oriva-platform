/**
 * What a caller sees from request validation after the move to zod 4 (#84).
 *
 * zod 4 renamed issue codes and tightened `.uuid()`. The API keeps its old answers: the `code`
 * on a validation error is the one it has always sent, and an id zod 3 accepted is still accepted.
 * Real zod, real request schemas: no mocks.
 */
import { formatZodErrors, publicIssueCode, validateRequestData, ValidationError } from '../../src/middleware/validation';
import { LoginBodySchema, PutProfileBodySchema } from '../../src/openapi/schemas/auth';
import { GroupIdParamSchema } from '../../src/openapi/schemas/groups';

const errorsOf = (schema: Parameters<typeof validateRequestData>[0], data: unknown) => {
  try {
    validateRequestData(schema, data);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    const parsed = (schema as { safeParse: (d: unknown) => { error: Parameters<typeof formatZodErrors>[0] } }).safeParse(data);
    return formatZodErrors(parsed.error);
  }
  throw new Error('expected the data to be refused');
};

describe('validation error codes stay as callers know them', () => {
  it('sends invalid_string, not zod 4\'s invalid_format, for a malformed email', () => {
    const errors = errorsOf(LoginBodySchema, { email: 'not-an-email', password: 'long-enough-password' });
    expect(errors).toEqual([{ field: 'email', message: expect.any(String), code: 'invalid_string' }]);
  });

  it('sends invalid_string for a malformed id', () => {
    expect(errorsOf(GroupIdParamSchema, { groupId: 'nope' })).toEqual([{ field: 'groupId', message: expect.any(String), code: 'invalid_string' }]);
  });

  it('leaves every other code alone', () => {
    expect(publicIssueCode('invalid_type')).toBe('invalid_type');
    expect(publicIssueCode('too_small')).toBe('too_small');
    expect(errorsOf(LoginBodySchema, {}).map((e) => [e.field, e.code])).toEqual([
      ['email', 'invalid_type'],
      ['password', 'invalid_type'],
    ]);
  });
});

describe('inputs zod 3 accepted are still accepted', () => {
  it('accepts an id without the RFC version bits, as zod 3 did', () => {
    expect(validateRequestData(GroupIdParamSchema, { groupId: '11111111-1111-1111-1111-111111111111' })).toEqual({
      groupId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('accepts free-form preferences keyed by name', () => {
    const body = validateRequestData(PutProfileBodySchema, { preferences: { theme: 'dark', digest: { weekly: true } } });
    expect(body.preferences).toEqual({ theme: 'dark', digest: { weekly: true } });
  });
});
