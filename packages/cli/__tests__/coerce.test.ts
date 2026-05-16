/**
 * @jest-environment node
 *
 * Ported verbatim from ultra-cli; coerce semantics are universal.
 */
import { coerceArgs } from '../src/coerce.js';

describe('coerceArgs', () => {
  it('coerces integer flag values', () => {
    const out = coerceArgs({ limit: '25' }, { properties: { limit: { type: 'integer' } } });
    expect(out).toEqual({ limit: 25 });
  });

  it('coerces number flag values', () => {
    const out = coerceArgs({ lat: '40.7' }, { properties: { lat: { type: 'number' } } });
    expect(out).toEqual({ lat: 40.7 });
  });

  it('coerces boolean flag values', () => {
    const out = coerceArgs(
      { active: 'true', archived: 'false' },
      { properties: { active: { type: 'boolean' }, archived: { type: 'boolean' } } }
    );
    expect(out).toEqual({ active: true, archived: false });
  });

  it('coerces array items by schema.items.type', () => {
    const out = coerceArgs(
      { ids: ['1', '2', '3'] },
      { properties: { ids: { type: 'array', items: { type: 'integer' } } } }
    );
    expect(out).toEqual({ ids: [1, 2, 3] });
  });

  it('passes strings through when type is string or unspecified', () => {
    const out = coerceArgs(
      { stage: 'booked', other: 'x' },
      { properties: { stage: { type: 'string' } } }
    );
    expect(out).toEqual({ stage: 'booked', other: 'x' });
  });

  it('keeps boolean flag (no value) as boolean true', () => {
    const out = coerceArgs({ debug: true }, { properties: { debug: { type: 'boolean' } } });
    expect(out).toEqual({ debug: true });
  });

  it('throws on invalid integer coercion', () => {
    expect(() =>
      coerceArgs({ limit: 'abc' }, { properties: { limit: { type: 'integer' } } })
    ).toThrow(/Expected integer/);
  });
});
