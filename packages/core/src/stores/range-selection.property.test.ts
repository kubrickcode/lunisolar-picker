import {
  brandEpochDay,
  type CalendarId,
  type DateString,
  type EpochDay,
  epochDayOf,
  gregory,
  type ParsedDate,
  parseDate,
} from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type RangeConstraints, resolveConstraints } from '../constraints/resolve-constraints';
import type { PickerContext } from '../context';
import { createTestContext } from '../testing/create-test-context';
import {
  createRangeSelectionState,
  displayedRange,
  type RangeSelectionEvent,
  type RangeSelectionState,
  rangeSelectionReducer,
  rangeValue,
} from './range-selection';
import {
  createSingleSelectionState,
  type SingleSelectionEvent,
  type SingleSelectionState,
  singleSelectionReducer,
  singleValue,
} from './single-selection';

// Goal: 단기 지원 범위 끝을 걸쳐 두어 음력으로 고를 수 없는 날과 포맷할 수 없는 프리셋까지 섞이게 함
const DAYS_AFTER_LUNAR_END = 10;
const DAYS_BEFORE_LUNAR_END = 30;
const DISABLED_DAY_DIVISOR = 7;
const MAX_EVENT_COUNT = 40;

const firstDay = dangi.supportedRange.max - DAYS_BEFORE_LUNAR_END;
const lastDay = dangi.supportedRange.max + DAYS_AFTER_LUNAR_END;

const epochDayArbitrary: fc.Arbitrary<EpochDay> = fc.integer({ min: firstDay, max: lastDay }).map(brandEpochDay);
const calendarIdArbitrary: fc.Arbitrary<CalendarId> = fc.constantFrom<CalendarId>(gregory.id, dangi.id);

const contextArbitrary: fc.Arbitrary<PickerContext> = fc
  .record({
    commitMode: fc.constantFrom('immediate', 'confirm'),
    dayCounts: fc.constantFrom<RangeConstraints>({}, { maxDays: 3 }, { minDays: 2 }, { maxDays: 7, minDays: 2 }),
    hasDisabledDays: fc.boolean(),
    isOpenEndAllowed: fc.boolean(),
    limitMode: fc.constantFrom('block', 'flag'),
  })
  .map(({ commitMode, dayCounts, hasDisabledDays, isOpenEndAllowed, limitMode }) =>
    createTestContext({
      calendars: [gregory, dangi],
      commitMode,
      constraints: resolveConstraints({
        ...dayCounts,
        ...(hasDisabledDays ? { isDateDisabled: isEveryNthDay } : {}),
        isOpenEndAllowed,
        limitMode,
      }),
    }),
  );

const selectedDayArbitrary = fc.record({ calendarId: calendarIdArbitrary, epochDay: epochDayArbitrary });

const rangeEventArbitrary: fc.Arbitrary<RangeSelectionEvent> = fc.oneof(
  selectedDayArbitrary.map((day): RangeSelectionEvent => ({ type: 'pointer.down', ...day })),
  epochDayArbitrary.map((epochDay): RangeSelectionEvent => ({ type: 'pointer.enter', epochDay })),
  fc.constant<RangeSelectionEvent>({ type: 'pointer.up' }),
  selectedDayArbitrary.map((day): RangeSelectionEvent => ({ type: 'date.select', ...day })),
  fc.constantFrom('start', 'end').map((handle): RangeSelectionEvent => ({ type: 'handle.grab', handle })),
  fc
    .record({
      calendarId: calendarIdArbitrary,
      end: fc.option(epochDayArbitrary, { nil: null }),
      start: epochDayArbitrary,
    })
    .map(
      ({ calendarId, end, start }): RangeSelectionEvent => ({ type: 'range.set', calendarId, range: { start, end } }),
    ),
  fc.constantFrom<RangeSelectionEvent>({ type: 'commit' }, { type: 'cancel' }, { type: 'clear' }),
  fc
    .option(
      fc.record({
        calendarId: calendarIdArbitrary,
        end: fc.option(epochDayArbitrary, { nil: null }),
        start: epochDayArbitrary,
      }),
      { nil: null },
    )
    .map(
      (selected): RangeSelectionEvent => ({
        type: 'value.sync',
        selected: selected && { calendarId: selected.calendarId, range: { start: selected.start, end: selected.end } },
      }),
    ),
);

const singleEventArbitrary: fc.Arbitrary<SingleSelectionEvent> = fc.oneof(
  selectedDayArbitrary.map((day): SingleSelectionEvent => ({ type: 'date.select', ...day })),
  fc.constantFrom<SingleSelectionEvent>({ type: 'commit' }, { type: 'cancel' }, { type: 'clear' }),
);

describe('selection properties', () => {
  describe('range selection', () => {
    it('only exposes values that parse back to the same dates in one calendar, with start before end', () => {
      fc.assert(
        fc.property(
          contextArbitrary,
          fc.array(rangeEventArbitrary, { maxLength: MAX_EVENT_COUNT }),
          (context, events) => {
            events.reduce<RangeSelectionState>((state, event) => {
              const next = rangeSelectionReducer(state, event, context);
              expectExposedRangeParses(next, context);
              return next;
            }, createRangeSelectionState(null));
          },
        ),
      );
    });

    it('keeps start on or before end in the displayed, drafted and committed ranges', () => {
      fc.assert(
        fc.property(
          contextArbitrary,
          fc.array(rangeEventArbitrary, { maxLength: MAX_EVENT_COUNT }),
          (context, events) => {
            events.reduce<RangeSelectionState>((state, event) => {
              const next = rangeSelectionReducer(state, event, context);
              [displayedRange(next), next.draft?.range ?? null, next.committed?.range ?? null].forEach((range) => {
                if (range?.end != null) expect(range.start).toBeLessThanOrEqual(range.end);
              });
              return next;
            }, createRangeSelectionState(null));
          },
        ),
      );
    });
  });

  describe('single selection', () => {
    it('only exposes a value that parses back to the committed day', () => {
      fc.assert(
        fc.property(
          contextArbitrary,
          fc.array(singleEventArbitrary, { maxLength: MAX_EVENT_COUNT }),
          (context, events) => {
            events.reduce<SingleSelectionState>((state, event) => {
              const next = singleSelectionReducer(state, event, context);
              const value = singleValue(next, context);
              if (value !== null) {
                const parsed = parseExposedDate(value, context);
                expect(parsed.epochDay).toBe(next.committed?.epochDay);
                expect(parsed.calendar).toBe(next.committed?.calendarId);
              }
              return next;
            }, createSingleSelectionState(null));
          },
        ),
      );
    });
  });
});

const isEveryNthDay = (date: DateString): boolean => epochDayOf(date) % DISABLED_DAY_DIVISOR === 0;

const expectExposedRangeParses = (state: RangeSelectionState, context: PickerContext): void => {
  const value = rangeValue(state, context);
  if (value === null) return;
  const start = parseExposedDate(value.start, context);
  if (value.end === null) return;
  const end = parseExposedDate(value.end, context);
  expect(end.calendar).toBe(start.calendar);
  expect(start.epochDay).toBeLessThanOrEqual(end.epochDay);
};

const parseExposedDate = (value: DateString, context: PickerContext): ParsedDate => {
  const parsed = parseDate(value, { calendars: context.calendars });
  if (!parsed.isOk) throw new Error(`exposed value "${value}" failed to parse: ${parsed.error}`);
  expect(parsed.value.value).toBe(value);
  return parsed.value;
};
