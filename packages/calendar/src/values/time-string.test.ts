import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { unwrapOk } from '../testing/unwrap-result';
import { formatTime, parseTime } from './time-string';

describe('time-string', () => {
  describe('parseTime', () => {
    it('reads a 24-hour time', () => {
      expect(unwrapOk(parseTime('14:30'))).toEqual({ hour: 14, minute: 30, value: '14:30' });
    });

    it('rejects 24:00 unless end of day is allowed', () => {
      expect(parseTime('24:00')).toEqual({ isOk: false, error: 'invalid-time' });
      expect(unwrapOk(parseTime('24:00', { isEndOfDayAllowed: true }))).toEqual({
        hour: 24,
        minute: 0,
        value: '24:00',
      });
    });

    it.each(['24:30', '9:30', '09:60', '25:00', '09:5', '0930', ' 09:30', '09:30:00', ''])(
      'rejects "%s" even when end of day is allowed',
      (input) => {
        expect(parseTime(input, { isEndOfDayAllowed: true })).toEqual({ isOk: false, error: 'invalid-time' });
      },
    );
  });

  describe('formatTime', () => {
    it('pads hours and minutes', () => {
      expect(unwrapOk(formatTime(9, 5))).toBe('09:05');
    });

    it.each([
      [24, 0],
      [23, 60],
      [-1, 0],
      [9.5, 0],
    ])('rejects %i:%i by default', (hour, minute) => {
      expect(formatTime(hour, minute)).toEqual({ isOk: false, error: 'invalid-time' });
    });

    it('round-trips every minute of the day through parseTime', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (hour, minute) => {
          const parsed = parseTime(unwrapOk(formatTime(hour, minute)));
          return parsed.isOk && parsed.value.hour === hour && parsed.value.minute === minute;
        }),
      );
    });
  });
});
