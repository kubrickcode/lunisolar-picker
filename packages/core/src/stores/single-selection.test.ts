import { type EpochDay, epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { createTestContext } from '../testing/create-test-context';
import { reduceEvents } from '../testing/reduce-events';
import { createSingleSelectionState, singleSelectionReducer, singleValue } from './single-selection';

const october = (day: number): EpochDay => epochDayFromCivil(2026, 10, day);

describe('single selection', () => {
  const empty = createSingleSelectionState(null);

  it('commits immediately in immediate mode', () => {
    const context = createTestContext();

    const next = singleSelectionReducer(
      empty,
      { type: 'date.select', epochDay: october(14), calendarId: 'gregory' },
      context,
    );

    expect(singleValue(next, context)).toBe('2026-10-14');
  });

  it('keeps the committed value until commit in confirm mode and restores it on cancel', () => {
    const context = createTestContext({ commitMode: 'confirm' });
    const committed = createSingleSelectionState({ epochDay: october(1), calendarId: 'gregory' });

    const drafted = singleSelectionReducer(
      committed,
      { type: 'date.select', epochDay: october(14), calendarId: 'gregory' },
      context,
    );
    const cancelled = singleSelectionReducer(drafted, { type: 'cancel' }, context);
    const confirmed = singleSelectionReducer(drafted, { type: 'commit' }, context);

    expect(singleValue(drafted, context)).toBe('2026-10-01');
    expect(cancelled.draft).toEqual({ epochDay: october(1), calendarId: 'gregory' });
    expect(singleValue(confirmed, context)).toBe('2026-10-14');
  });

  it('ignores disabled and out-of-bounds days without changing the state reference', () => {
    const context = createTestContext({
      constraints: resolveConstraints({ max: '2026-10-20', isDateDisabled: (date) => date === '2026-10-14' }),
    });

    expect(
      singleSelectionReducer(empty, { type: 'date.select', epochDay: october(14), calendarId: 'gregory' }, context),
    ).toBe(empty);
    expect(
      singleSelectionReducer(empty, { type: 'date.select', epochDay: october(21), calendarId: 'gregory' }, context),
    ).toBe(empty);
  });

  it('keeps the entry calendar so the output carries the lunar annotation', () => {
    const context = createTestContext({ calendars: [gregory, dangi] });

    const next = singleSelectionReducer(
      empty,
      { type: 'date.select', epochDay: october(14), calendarId: 'dangi' },
      context,
    );

    expect(singleValue(next, context)).toBe('2026-10-14[u-ca=dangi]');
  });

  it('clears and syncs an external value', () => {
    const context = createTestContext();
    const events = [{ type: 'date.select', epochDay: october(14), calendarId: 'gregory' }, { type: 'clear' }] as const;

    expect(singleValue(reduceEvents(singleSelectionReducer, empty, events, context), context)).toBeNull();
    const synced = singleSelectionReducer(
      empty,
      { type: 'value.sync', selected: { epochDay: october(3), calendarId: 'gregory' } },
      context,
    );
    expect(singleValue(synced, context)).toBe('2026-10-03');
  });
});
