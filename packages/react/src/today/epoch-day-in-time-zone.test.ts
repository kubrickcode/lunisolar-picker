import { epochDayFromCivil } from '@lunisolar-picker/calendar';
import { describe, expect, it } from 'vitest';
import { epochDayInTimeZone } from './epoch-day-in-time-zone';

describe('epochDayInTimeZone', () => {
  const instant = Date.UTC(2026, 9, 14, 15, 30);

  it.each([
    ['UTC', epochDayFromCivil(2026, 10, 14)],
    ['Asia/Seoul', epochDayFromCivil(2026, 10, 15)],
    ['America/Los_Angeles', epochDayFromCivil(2026, 10, 14)],
  ])('reads the civil date of the instant in %s', (timeZone, expected) => {
    expect(epochDayInTimeZone(instant, timeZone)).toBe(expected);
  });

  it('reads the previous day in a zone behind UTC near midnight', () => {
    expect(epochDayInTimeZone(Date.UTC(2026, 9, 14, 5, 0), 'America/Los_Angeles')).toBe(
      epochDayFromCivil(2026, 10, 13),
    );
  });
});
