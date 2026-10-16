import { gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import type { PickerSettings } from '../index';
import { epochDayAt, FIXED_TODAY } from '../testing/korean-fixture';
import { formatDisplayDate, formatDisplayRange } from './format-display-value';

const KOREAN_SETTINGS: PickerSettings = {
  calendarKey: 'gregory,dangi',
  calendars: [gregory, dangi],
  locale: ko,
  timeZone: 'Asia/Seoul',
  todayEpochDay: epochDayAt(FIXED_TODAY),
  weekStartsOn: 0,
};

describe('formatDisplayDate', () => {
  it('writes the value in field order with the given separator', () => {
    expect(formatDisplayDate('2026-10-20', KOREAN_SETTINGS, '-')).toBe('2026-10-20');
  });

  it('writes a lunar value in its own calendar with the leap-month prefix', () => {
    expect(formatDisplayDate('1990-06-23[u-ca=dangi]', KOREAN_SETTINGS)).toBe('1990. 윤05. 01');
  });

  it.each([null, undefined, '', '2026-02-30', '2026-10-20[u-ca=chinese]'])('shows nothing for %s', (value) => {
    expect(formatDisplayDate(value, KOREAN_SETTINGS)).toBe('');
  });
});

describe('formatDisplayRange', () => {
  it('joins both ends with the locale range separator', () => {
    expect(formatDisplayRange({ start: '2026-10-01', end: '2026-10-20' }, KOREAN_SETTINGS, '-')).toBe(
      '2026-10-01 ~ 2026-10-20',
    );
  });

  it('shows only the start of an open-ended range', () => {
    expect(formatDisplayRange({ start: '2026-10-01', end: null }, KOREAN_SETTINGS, '-')).toBe('2026-10-01');
  });
});
