import { type DateRangeValue, LunisolarPickerError } from '@lunisolar-picker/calendar';
import type { Validity } from '@lunisolar-picker/core';
import { type Context, createContext, useContext } from 'react';
import type { DateRangeInput } from '../index';

export const PickerSelectionContext: Context<PickerSelection | null> = createContext<PickerSelection | null>(null);

// Goal: DateRangePicker의 presets·footer 슬롯이 picker 안 범위 달력을 다루는 통로 (계약 §3.5)
export interface PickerSelection {
  // Goal: 확정 전 고른 범위를 확정하지 않고 닫음
  cancel(): void;
  // Goal: 고른 범위를 확정해 onValueChange로 알리고 닫음. 같은 클릭에서 닫혀도 값이 전달됨 (preflight 1.4)
  commit(): void;
  // Goal: 지금 보이는 범위(확인 모드면 확정 전 범위). 프리셋 버튼의 선택 표시에 씀
  readonly draftRange: DateRangeValue | null;
  // Goal: 앱이 정한 범위를 넣음. 즉시 모드에서 양 끝이 있는 범위면 확정하고 닫음
  setRange(range: DateRangeInput | null): void;
  // Goal: 보이는 범위의 유효성. 기간 초과 같은 경고를 앱이 직접 그릴 때 씀
  readonly validity: Validity;
}

// Goal: 프리셋 버튼 종류·라벨은 앱이 정하고, 라이브러리는 '범위를 넣어 선택'하는 통로만 줌 (스펙 2.2)
export const usePickerSelection = (): PickerSelection => {
  const selection = useContext(PickerSelectionContext);
  if (!selection) {
    throw new LunisolarPickerError('usePickerSelection must be used inside DateRangePicker presets or footer');
  }
  return selection;
};
