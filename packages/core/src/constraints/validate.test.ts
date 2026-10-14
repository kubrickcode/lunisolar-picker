import { type EpochDay, epochDayFromCivil } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from './resolve-constraints';
import { isEpochDayInBlockedRange, validateEpochDay, validateEpochRange } from './validate';

const october = (day: number): EpochDay => epochDayFromCivil(2026, 10, day);

describe('validateEpochDay', () => {
  const resolved = resolveConstraints({
    min: '2026-10-01',
    max: '2026-10-31',
    isDateDisabled: (date) => date === '2026-10-10',
  });

  it('accepts both inclusive bounds', () => {
    expect(validateEpochDay(october(1), resolved).isValid).toBe(true);
    expect(validateEpochDay(october(31), resolved).isValid).toBe(true);
  });

  it('names the side that is out of bounds', () => {
    expect(validateEpochDay(epochDayFromCivil(2026, 9, 30), resolved).reasons).toEqual(['before-min']);
    expect(validateEpochDay(epochDayFromCivil(2026, 11, 1), resolved).reasons).toEqual(['after-max']);
  });

  it('reports a disabled date', () => {
    expect(validateEpochDay(october(10), resolved).reasons).toEqual(['disabled-date']);
  });

  it('reports outside-calendar-range rather than before-min for days the calendar cannot show', () => {
    const lunar = resolveConstraints({}, dangi, [dangi]);
    expect(validateEpochDay(epochDayFromCivil(1900, 1, 30), lunar).reasons).toEqual(['outside-calendar-range']);
  });
});

describe('validateEpochRange', () => {
  const limited = resolveConstraints({ maxDays: 3, minDays: 2 });

  it('counts both ends so a three-day range fits a three-day limit', () => {
    expect(validateEpochRange({ start: october(13), end: october(15) }, limited).isValid).toBe(true);
    expect(validateEpochRange({ start: october(13), end: october(16) }, limited).reasons).toEqual(['range-too-long']);
  });

  it('reports a range shorter than the minimum', () => {
    expect(validateEpochRange({ start: october(13), end: october(13) }, limited).reasons).toEqual(['range-too-short']);
  });

  it('requires an end unless open ranges are allowed', () => {
    expect(validateEpochRange({ start: october(13), end: null }, limited).reasons).toEqual(['incomplete']);
    const openEnded = resolveConstraints({ isOpenEndAllowed: true });
    expect(validateEpochRange({ start: october(13), end: null }, openEnded).isValid).toBe(true);
  });

  it('treats a reversed range the same as the forward one', () => {
    expect(validateEpochRange({ start: october(16), end: october(13) }, limited).reasons).toEqual(['range-too-long']);
    expect(validateEpochRange({ start: october(15), end: october(13) }, limited).isValid).toBe(true);
  });

  it('reports disabled days inside the range separately from disabled endpoints', () => {
    const resolved = resolveConstraints({ isDateDisabled: (date) => date === '2026-10-14' || date === '2026-10-17' });

    expect(validateEpochRange({ start: october(13), end: october(15) }, resolved).reasons).toEqual([
      'range-includes-disabled',
    ]);
    expect(validateEpochRange({ start: october(15), end: october(17) }, resolved).reasons).toEqual(['disabled-date']);
  });
});

describe('isEpochDayInBlockedRange', () => {
  it('blocks days past the maximum only in block mode', () => {
    const blocking = resolveConstraints({ maxDays: 3, limitMode: 'block' });
    const flagging = resolveConstraints({ maxDays: 3, limitMode: 'flag' });

    expect(isEpochDayInBlockedRange(october(13), october(15), blocking)).toBe(false);
    expect(isEpochDayInBlockedRange(october(13), october(16), blocking)).toBe(true);
    expect(isEpochDayInBlockedRange(october(13), october(10), blocking)).toBe(true);
    expect(isEpochDayInBlockedRange(october(13), october(16), flagging)).toBe(false);
  });

  it('blocks days that would make the range shorter than the minimum, except the anchor itself', () => {
    const resolved = resolveConstraints({ minDays: 3 });

    expect(isEpochDayInBlockedRange(october(13), october(14), resolved)).toBe(true);
    expect(isEpochDayInBlockedRange(october(13), october(13), resolved)).toBe(false);
    expect(isEpochDayInBlockedRange(october(13), october(15), resolved)).toBe(false);
  });
});
