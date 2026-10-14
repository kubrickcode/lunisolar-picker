import { gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { buildMonthGrid } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import { buildCellLabel } from './cell-label';

const october = buildMonthGrid({
  calendar: gregory,
  month: { year: 2026, monthCode: 'M10' },
  weekStartsOn: 0,
  secondaryCalendar: dangi,
});
const october14 = october.weeks.flat().find((cell) => cell.date === '2026-10-14');

describe('buildCellLabel', () => {
  if (!october14) throw new Error('October 2026 grid should contain the 14th');

  it('reads only the solar date when no secondary calendar is shown', () => {
    const label = buildCellLabel({
      cell: october14,
      calendar: gregory,
      secondaryCalendar: null,
      locale: ko,
      appLabel: undefined,
    });

    expect(label).toBe(ko.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory'));
  });

  it('appends the lunar date and the app label in that order', () => {
    const label = buildCellLabel({
      cell: october14,
      calendar: gregory,
      secondaryCalendar: dangi,
      locale: ko,
      appLabel: '사내 휴무',
    });

    expect(label).toBe(
      [
        ko.formatDayLabel({ year: 2026, monthCode: 'M10', day: 14 }, 3, 'gregory'),
        `${ko.calendarNames.dangi} ${ko.formatDateLabel({ year: 2026, monthCode: 'M09', day: 4 }, 'dangi')}`,
        '사내 휴무',
      ].join(', '),
    );
  });
});
