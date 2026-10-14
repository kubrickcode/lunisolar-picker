import { describe, expect, expectTypeOf, it } from 'vitest';
import { compactObject } from './compact-object';

describe('compactObject', () => {
  it('drops keys whose value is undefined', () => {
    expect(compactObject({ max: undefined, min: '2026-01-01' })).toEqual({ min: '2026-01-01' });
  });

  it('keeps required keys required and makes only undefined-accepting keys optional', () => {
    const shape: { readonly id: string; readonly label: string | undefined } = { id: 'a', label: undefined };

    expectTypeOf(compactObject(shape)).toEqualTypeOf<{ readonly id: string } & { readonly label?: string }>();
  });
});
