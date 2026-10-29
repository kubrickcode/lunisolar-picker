import { gregory } from '@lunisolar-picker/calendar';
import { type CommitMode, type PickerContext, type RangeConstraints, resolveConstraints } from '@lunisolar-picker/core';
import { useMemo } from 'react';
import { compactObject } from '../utilities/compact-object';
import type { PickerSettings } from './use-picker-settings';

export type PickerContextOptions = {
  readonly commitMode: CommitMode;
  readonly constraints: RangeConstraints;
  readonly numberOfMonths: number;
};

// Constraint: 컨텍스트의 제약은 양력 기준. 표시 역법의 지원 범위는 core 리듀서가 boundsFor로 겹쳐 계산함 (계약 §2.2)
export const usePickerContext = (settings: PickerSettings, options: PickerContextOptions): PickerContext => {
  const { min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed } = options.constraints;
  const knownCalendars = settings.calendars;
  const constraints = useMemo(
    () =>
      resolveConstraints(
        compactObject({ min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed }),
        gregory,
        knownCalendars,
      ),
    [min, max, isDateDisabled, minDays, maxDays, limitMode, isOpenEndAllowed, knownCalendars],
  );
  const { calendars, todayEpochDay, weekStartsOn, locale } = settings;
  const { commitMode, numberOfMonths } = options;
  return useMemo(
    () => ({ calendars, constraints, today: todayEpochDay, weekStartsOn, locale, commitMode, numberOfMonths }),
    [calendars, constraints, todayEpochDay, weekStartsOn, locale, commitMode, numberOfMonths],
  );
};
