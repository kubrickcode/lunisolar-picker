import { calendarIdOf, type DateString, epochDayOf } from '@lunisolar-picker/calendar';
import type { SelectedDay } from '@lunisolar-picker/core';

const EMPTY_SELECTION_KEY = 'empty';

// Goal: 문자열 해석과 잘못된 값 알림은 useParsedValue·parseOptionalDate가 한 번만 함. 여기서는 이미 정규화된 값을 store 모양으로 바꿈 (preflight 3.4)
export const parseSelection = (value: DateString | null): SelectedDay | null =>
  value === null ? null : { epochDay: epochDayOf(value), calendarId: calendarIdOf(value) };

// Goal: 확정 값의 동일성 문자열. 같은 날이라도 역법이 다르면 공개 값 문자열이 달라지므로 역법을 포함함
export const selectionKey = (selected: SelectedDay | null): string =>
  selected === null ? EMPTY_SELECTION_KEY : `${selected.calendarId}:${selected.epochDay}`;
