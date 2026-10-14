import { describe, expect, it } from 'vitest';
import {
  type DateRangeInput,
  type PickerSettings,
  useControllableState,
  usePickerSettings,
  useSheetContext,
} from './index';

describe('package entry', () => {
  it('exposes the sheet context hook and the range input type that M4 pickers import', () => {
    // Goal: 타입은 런타임에 남지 않으므로 공개 타입으로 값을 만들어 타입 검사(just check)가 export를 확인하게 함
    const openRange: DateRangeInput = { start: '2026-10-13', end: null };

    expect(typeof useSheetContext).toBe('function');
    expect(openRange.end).toBeNull();
  });

  it('exposes the settings and controllable-state hooks that completed pickers build on', () => {
    // Goal: 완성형 picker를 앱에 복사해도 컴파일되도록 공개 API만으로 설정·제어 상태를 다룸 (ADR-0001, preflight 4.12)
    const readWeekStart = (settings: PickerSettings): number => settings.weekStartsOn;

    expect(typeof usePickerSettings).toBe('function');
    expect(typeof useControllableState).toBe('function');
    expect(typeof readWeekStart).toBe('function');
  });
});
