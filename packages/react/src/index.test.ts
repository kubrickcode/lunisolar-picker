import { describe, expect, it } from 'vitest';
import { type DateRangeInput, useSheetContext } from './index';

describe('package entry', () => {
  it('exposes the sheet context hook and the range input type that M4 pickers import', () => {
    // Goal: 타입은 런타임에 남지 않으므로 공개 타입으로 값을 만들어 타입 검사(just check)가 export를 확인하게 함
    const openRange: DateRangeInput = { start: '2026-10-13', end: null };

    expect(typeof useSheetContext).toBe('function');
    expect(openRange.end).toBeNull();
  });
});
