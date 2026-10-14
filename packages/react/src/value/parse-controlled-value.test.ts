import { gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { parseOptionalDate, parseOptionalRange, parseOptionalTime } from './parse-controlled-value';

const calendars = [gregory, dangi];

describe('parse-controlled-value', () => {
  it.each([undefined, null, ''])('treats %s as an empty value without a reason', (input) => {
    expect(parseOptionalDate(input, calendars)).toEqual({ value: null, invalidReason: null });
  });

  it('keeps a canonical lunar entry as is', () => {
    expect(parseOptionalDate('1990-06-23[u-ca=dangi]', calendars)).toEqual({
      value: '1990-06-23[u-ca=dangi]',
      invalidReason: null,
    });
  });

  it('reports why a non-canonical date was rejected', () => {
    expect(parseOptionalDate('2026-1-5', calendars)).toEqual({ value: null, invalidReason: 'invalid-date' });
  });

  it('accepts 24:00 only when end of day is allowed', () => {
    expect(parseOptionalTime('24:00', { isEndOfDayAllowed: false })).toEqual({
      value: null,
      invalidReason: 'invalid-time',
    });
    expect(parseOptionalTime('24:00', { isEndOfDayAllowed: true })).toEqual({ value: '24:00', invalidReason: null });
  });

  it('normalizes a reversed range and rejects a range with an invalid end', () => {
    expect(parseOptionalRange({ start: '2026-10-17', end: '2026-10-13' }, calendars)).toEqual({
      value: { start: '2026-10-13', end: '2026-10-17' },
      invalidReason: null,
    });
    expect(parseOptionalRange({ start: '2026-10-13', end: '2026-10-32' }, calendars)).toEqual({
      value: null,
      invalidReason: 'invalid-date',
    });
  });
});
