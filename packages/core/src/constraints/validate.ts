import { brandEpochDay, type EpochDay, type ValidationReason } from '@lunisolar-picker/calendar';
import { type EpochRange, invalidBecause, type Validity } from '../types';
import type { ResolvedConstraints } from './resolve-constraints';

// Goal: 'block' 모드에서 anchor 기준으로 범위 길이 제한을 어기게 될 날은 선택 중에 고를 수 없게 함 (스펙 2.2)
export const isEpochDayInBlockedRange = (
  anchor: EpochDay,
  candidate: EpochDay,
  constraints: ResolvedConstraints,
): boolean => {
  if (constraints.limitMode !== 'block') return false;
  const dayCount = Math.abs(candidate - anchor) + 1;
  const isTooLong = constraints.maxDays !== null && dayCount > constraints.maxDays;
  const isTooShort = constraints.minDays !== null && dayCount < constraints.minDays;
  return isTooLong || isTooShort;
};

export const validateEpochDay = (epochDay: EpochDay, constraints: ResolvedConstraints): Validity =>
  invalidBecause(dayReasons(epochDay, constraints));

export const validateEpochRange = (range: EpochRange, constraints: ResolvedConstraints): Validity => {
  const startReasons = dayReasons(range.start, constraints);
  if (range.end === null) {
    return invalidBecause([...startReasons, ...(constraints.isOpenEndAllowed ? [] : (['incomplete'] as const))]);
  }
  const first = brandEpochDay(Math.min(range.start, range.end));
  const last = brandEpochDay(Math.max(range.start, range.end));
  const dayCount = last - first + 1;
  const isTooShort = constraints.minDays !== null && dayCount < constraints.minDays;
  const isTooLong = constraints.maxDays !== null && dayCount > constraints.maxDays;
  const otherReasons: readonly ValidationReason[] = [
    ...startReasons,
    ...dayReasons(range.end, constraints),
    ...(isTooShort ? (['range-too-short'] as const) : []),
    ...(isTooLong ? (['range-too-long'] as const) : []),
  ];
  // Goal: 이미 무효인 범위에서는 비용이 큰 isDateDisabled 순회를 생략함
  const hasDisabledInside = otherReasons.length === 0 && hasDisabledDayBetween(first, last, constraints);
  return invalidBecause([...otherReasons, ...(hasDisabledInside ? (['range-includes-disabled'] as const) : [])]);
};

const dayReasons = (epochDay: EpochDay, constraints: ResolvedConstraints): readonly ValidationReason[] => {
  if (epochDay < constraints.supportedRange.min || epochDay > constraints.supportedRange.max) {
    return ['outside-calendar-range'];
  }
  if (epochDay < constraints.minEpochDay) return ['before-min'];
  if (epochDay > constraints.maxEpochDay) return ['after-max'];
  return constraints.isEpochDayDisabled(epochDay) ? ['disabled-date'] : [];
};

const hasDisabledDayBetween = (start: EpochDay, end: EpochDay, constraints: ResolvedConstraints): boolean => {
  for (let epochDay = start + 1; epochDay < end; epochDay += 1) {
    if (constraints.isEpochDayDisabled(brandEpochDay(epochDay))) return true;
  }
  return false;
};
