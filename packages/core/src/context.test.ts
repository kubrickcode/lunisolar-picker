import { gregory, LunisolarPickerError } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { findCalendar } from './context';

describe('findCalendar', () => {
  it('finds a calendar by id', () => {
    expect(findCalendar([gregory, dangi], 'dangi')).toBe(dangi);
  });

  it('throws when the calendar was not provided', () => {
    expect(() => findCalendar([gregory], 'dangi')).toThrow(LunisolarPickerError);
  });
});
