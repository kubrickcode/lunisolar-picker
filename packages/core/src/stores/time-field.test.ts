import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { describe, expect, it } from 'vitest';
import { reduceEvents } from '../testing/reduce-events';
import { timeString } from '../testing/time-string';
import { createTimeFieldState, type TimeFieldEvent, timeFieldReducer, timeFieldResult } from './time-field';

const FIVE_MINUTES = { minuteStep: 5, isEndOfDayAllowed: false };
const END_OF_DAY = { minuteStep: 1, isEndOfDayAllowed: true };

function typed(digits: string): TimeFieldEvent[] {
  return [
    { type: 'segment.focus', index: 0 },
    ...[...digits].map((digit) => ({ type: 'digit.type', digit: Number(digit) }) as const),
  ];
}

describe('time field', () => {
  it('reads three typed digits as hour and minute', () => {
    const state = reduceEvents(timeFieldReducer, createTimeFieldState(null, FIVE_MINUTES), typed('930'), FIVE_MINUTES);

    expect(timeFieldResult(state, FIVE_MINUTES)).toEqual({ time: '09:30', validity: { isValid: true, reasons: [] } });
  });

  it('lets the hour reach 24 only when end of day is allowed', () => {
    expect(createTimeFieldState(null, FIVE_MINUTES).segments[0]?.maxValue).toBe(23);
    expect(createTimeFieldState(null, END_OF_DAY).segments[0]?.maxValue).toBe(24);
    const state = reduceEvents(timeFieldReducer, createTimeFieldState(null, END_OF_DAY), typed('2400'), END_OF_DAY);
    expect(timeFieldResult(state, END_OF_DAY).time).toBe('24:00');
  });

  it('rejects 24 with minutes even when end of day is allowed', () => {
    const state = reduceEvents(timeFieldReducer, createTimeFieldState(null, END_OF_DAY), typed('2430'), END_OF_DAY);

    expect(timeFieldResult(state, END_OF_DAY)).toEqual({
      time: null,
      validity: { isValid: false, reasons: ['invalid-time'] },
    });
  });

  it('snaps minute stepping to the step size', () => {
    const state = createTimeFieldState(timeString('07:07'), FIVE_MINUTES);
    const focused = timeFieldReducer(state, { type: 'segment.focus', index: 1 }, FIVE_MINUTES);

    expect(
      timeFieldResult(timeFieldReducer(focused, { type: 'segment.step', amount: 1 }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('07:10');
    expect(
      timeFieldResult(timeFieldReducer(focused, { type: 'segment.step', amount: -1 }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('07:05');
  });

  it('wraps the hour past 23', () => {
    const focused = timeFieldReducer(
      createTimeFieldState(timeString('23:00'), FIVE_MINUTES),
      { type: 'segment.focus', index: 0 },
      FIVE_MINUTES,
    );

    expect(
      timeFieldResult(timeFieldReducer(focused, { type: 'segment.step', amount: 1 }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('00:00');
  });

  it('steps the hour through 24 and back to 0 when end of day is allowed', () => {
    const focused = timeFieldReducer(
      createTimeFieldState(timeString('23:00'), END_OF_DAY),
      { type: 'segment.focus', index: 0 },
      END_OF_DAY,
    );

    const endOfDay = timeFieldReducer(focused, { type: 'segment.step', amount: 1 }, END_OF_DAY);
    const midnight = timeFieldReducer(endOfDay, { type: 'segment.step', amount: 1 }, END_OF_DAY);

    expect(timeFieldResult(endOfDay, END_OF_DAY).time).toBe('24:00');
    expect(timeFieldResult(midnight, END_OF_DAY).time).toBe('00:00');
  });

  it('wraps the minute from 55 to 00 without changing the hour', () => {
    const focused = timeFieldReducer(
      createTimeFieldState(timeString('07:55'), FIVE_MINUTES),
      { type: 'segment.focus', index: 1 },
      FIVE_MINUTES,
    );

    expect(
      timeFieldResult(timeFieldReducer(focused, { type: 'segment.step', amount: 1 }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('07:00');
  });

  it('reads pasted times with or without a colon', () => {
    const empty = createTimeFieldState(null, FIVE_MINUTES);

    expect(
      timeFieldResult(timeFieldReducer(empty, { type: 'text.paste', text: '14:30' }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('14:30');
    expect(
      timeFieldResult(timeFieldReducer(empty, { type: 'text.paste', text: '1430' }, FIVE_MINUTES), FIVE_MINUTES).time,
    ).toBe('14:30');
  });

  it('treats an empty time as valid and one filled segment as incomplete', () => {
    const partial = reduceEvents(timeFieldReducer, createTimeFieldState(null, FIVE_MINUTES), typed('9'), FIVE_MINUTES);

    expect(timeFieldResult(createTimeFieldState(null, FIVE_MINUTES), FIVE_MINUTES).validity.isValid).toBe(true);
    expect(timeFieldResult(partial, FIVE_MINUTES).validity.reasons).toEqual(['incomplete']);
  });

  it('keeps the same state when the same time is synced again', () => {
    const state = createTimeFieldState(timeString('07:05'), FIVE_MINUTES);

    expect(timeFieldReducer(state, { type: 'value.sync', time: timeString('07:05') }, FIVE_MINUTES)).toBe(state);
  });

  it('rejects a minuteStep that does not divide an hour', () => {
    expect(() => createTimeFieldState(null, { isEndOfDayAllowed: false, minuteStep: 7 })).toThrow(LunisolarPickerError);
  });
});
