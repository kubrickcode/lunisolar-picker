import { brandEpochDay, type EpochDay, epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { describe, expect, it } from 'vitest';
import { resolveConstraints } from '../constraints/resolve-constraints';
import { createTestContext } from '../testing/create-test-context';
import { reduceEvents } from '../testing/reduce-events';
import {
  createRangeSelectionState,
  displayedRange,
  type RangeSelectionEvent,
  rangeSelectionReducer,
  rangeValidity,
  rangeValue,
} from './range-selection';

const RELEASE: RangeSelectionEvent = { type: 'pointer.up' };

const october = (day: number): EpochDay => epochDayFromCivil(2026, 10, day);

const select = (day: number): RangeSelectionEvent => ({
  type: 'date.select',
  epochDay: october(day),
  calendarId: 'gregory',
});

const press = (day: number): RangeSelectionEvent => ({
  type: 'pointer.down',
  epochDay: october(day),
  calendarId: 'gregory',
});

const enter = (day: number): RangeSelectionEvent => ({ type: 'pointer.enter', epochDay: october(day) });

const empty = createRangeSelectionState(null);

describe('range selection', () => {
  describe('two taps', () => {
    const context = createTestContext();

    it('completes and orders the range on the second selection', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [select(17), select(13)], context);

      expect(rangeValue(state, context)).toEqual({ start: '2026-10-13', end: '2026-10-17' });
    });

    it('starts a new range when selecting again after a completed range', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [select(13), select(17), select(20)], context);

      expect(displayedRange(state)).toEqual({ start: october(20), end: null });
      expect(rangeValue(state, context)).toEqual({ start: '2026-10-13', end: '2026-10-17' });
    });

    it('previews the hovered end while waiting for the second selection', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [select(13), enter(16)], context);

      expect(displayedRange(state)).toEqual({ start: october(13), end: october(16) });
    });
  });

  describe('maximum length', () => {
    it('ignores days past the limit in block mode', () => {
      const context = createTestContext({ constraints: resolveConstraints({ maxDays: 3, limitMode: 'block' }) });

      const state = reduceEvents(rangeSelectionReducer, empty, [select(13), select(16)], context);
      const completed = rangeSelectionReducer(state, select(15), context);

      expect(displayedRange(state)).toEqual({ start: october(13), end: null });
      expect(rangeValue(completed, context)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
    });

    it('accepts days past the limit in flag mode and reports the reason', () => {
      const context = createTestContext({ constraints: resolveConstraints({ maxDays: 3, limitMode: 'flag' }) });

      const state = reduceEvents(rangeSelectionReducer, empty, [select(13), select(16)], context);

      expect(rangeValidity(state, context)).toEqual({ isValid: false, reasons: ['range-too-long'] });
    });
  });

  describe('minimum length in block mode', () => {
    const context = createTestContext({ constraints: resolveConstraints({ minDays: 3, limitMode: 'block' }) });

    it('ignores a second tap that would make the range too short, the anchor included', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [select(13), select(13), select(14)], context);
      const completed = rangeSelectionReducer(state, select(15), context);

      expect(displayedRange(state)).toEqual({ start: october(13), end: null });
      expect(rangeValue(completed, context)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
    });

    it('holds the preview when dragging back onto the anchor', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [press(13), enter(15), enter(13)], context);
      const released = rangeSelectionReducer(state, RELEASE, context);

      expect(state.preview).toBe(october(15));
      expect(rangeValue(released, context)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
    });
  });

  describe('dragging', () => {
    const context = createTestContext();

    it('completes the range when the pointer is released after dragging', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [press(13), enter(14), enter(16), RELEASE], context);

      expect(rangeValue(state, context)).toEqual({ start: '2026-10-13', end: '2026-10-16' });
    });

    it('treats press and release on the same day as the first of two taps', () => {
      const state = reduceEvents(rangeSelectionReducer, empty, [press(13), RELEASE], context);
      const completed = reduceEvents(rangeSelectionReducer, state, [press(15), RELEASE], context);

      expect(state.pointerPhase).toBe('idle');
      expect(displayedRange(state)).toEqual({ start: october(13), end: null });
      expect(rangeValue(completed, context)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
    });

    it('holds the preview on the last valid day while passing over a disabled day', () => {
      const blocked = createTestContext({
        constraints: resolveConstraints({ isDateDisabled: (date) => date === '2026-10-16' }),
      });

      const state = reduceEvents(rangeSelectionReducer, empty, [press(13), enter(15), enter(16)], blocked);
      const released = rangeSelectionReducer(state, RELEASE, blocked);

      expect(state.preview).toBe(october(15));
      expect(rangeValue(released, blocked)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
    });

    it('extends a completed range by dragging its end handle', () => {
      const completed = reduceEvents(rangeSelectionReducer, empty, [select(13), select(15)], context);

      const extended = reduceEvents(
        rangeSelectionReducer,
        completed,
        [{ type: 'handle.grab', handle: 'end' }, enter(18), RELEASE],
        context,
      );

      expect(rangeValue(extended, context)).toEqual({ start: '2026-10-13', end: '2026-10-18' });
    });

    it('swaps the ends when a handle is dragged past the other end', () => {
      const completed = reduceEvents(rangeSelectionReducer, empty, [select(13), select(15)], context);

      const swapped = reduceEvents(
        rangeSelectionReducer,
        completed,
        [{ type: 'handle.grab', handle: 'end' }, enter(10), RELEASE],
        context,
      );

      expect(rangeValue(swapped, context)).toEqual({ start: '2026-10-10', end: '2026-10-13' });
    });

    it('ignores grabbing a handle whose opposite end is no longer selectable', () => {
      const blocked = createTestContext({
        constraints: resolveConstraints({ isDateDisabled: (date) => date === '2026-10-13' }),
      });
      const state = createRangeSelectionState({
        range: { start: october(13), end: october(15) },
        calendarId: 'gregory',
      });

      expect(rangeSelectionReducer(state, { type: 'handle.grab', handle: 'end' }, blocked)).toBe(state);
      expect(rangeSelectionReducer(state, { type: 'handle.grab', handle: 'start' }, blocked).anchor).toBe(october(15));
    });

    it('keeps the state reference for a release while idle and for entering the previewed day again', () => {
      const previewing = reduceEvents(rangeSelectionReducer, empty, [select(13), enter(16)], context);

      expect(rangeSelectionReducer(empty, RELEASE, context)).toBe(empty);
      expect(rangeSelectionReducer(previewing, enter(16), context)).toBe(previewing);
    });

    it('starts a new range when an end handle is clicked without dragging', () => {
      const completed = reduceEvents(rangeSelectionReducer, empty, [select(13), select(15)], context);

      const clicked = reduceEvents(
        rangeSelectionReducer,
        completed,
        [{ type: 'handle.grab', handle: 'end' }, RELEASE],
        context,
      );

      expect(displayedRange(clicked)).toEqual({ start: october(15), end: null });
    });
  });

  describe('commit modes and presets', () => {
    it('applies a preset immediately in immediate mode', () => {
      const context = createTestContext();

      const state = rangeSelectionReducer(
        empty,
        { type: 'range.set', range: { start: october(17), end: october(11) }, calendarId: 'gregory' },
        context,
      );

      expect(rangeValue(state, context)).toEqual({ start: '2026-10-11', end: '2026-10-17' });
    });

    it('ignores a preset the entry calendar cannot represent without changing the state reference', () => {
      const context = createTestContext({ calendars: [gregory, dangi] });
      const lunarEnd = dangi.supportedRange.max;
      const event: RangeSelectionEvent = {
        type: 'range.set',
        range: { start: brandEpochDay(lunarEnd - 2), end: brandEpochDay(lunarEnd + 1) },
        calendarId: 'dangi',
      };

      expect(rangeSelectionReducer(empty, event, context)).toBe(empty);
    });

    it('stores a preset that breaks min, max or length rules and reports it through validity', () => {
      const context = createTestContext({
        constraints: resolveConstraints({ max: '2026-10-20', maxDays: 3, limitMode: 'block' }),
      });

      const state = rangeSelectionReducer(
        empty,
        { type: 'range.set', range: { start: october(18), end: october(25) }, calendarId: 'gregory' },
        context,
      );

      expect(rangeValue(state, context)).toEqual({ start: '2026-10-18', end: '2026-10-25' });
      expect(rangeValidity(state, context)).toEqual({ isValid: false, reasons: ['after-max', 'range-too-long'] });
    });

    it('keeps the state reference when the same preset is applied again', () => {
      const context = createTestContext();
      const event: RangeSelectionEvent = {
        type: 'range.set',
        range: { start: october(11), end: october(17) },
        calendarId: 'gregory',
      };
      const reversed: RangeSelectionEvent = {
        type: 'range.set',
        range: { start: october(17), end: october(11) },
        calendarId: 'gregory',
      };
      const state = rangeSelectionReducer(empty, event, context);

      expect(rangeSelectionReducer(state, event, context)).toBe(state);
      expect(rangeSelectionReducer(state, reversed, context)).toBe(state);
    });

    it('rejects an open-ended preset unless open ranges are allowed', () => {
      const closed = createTestContext();
      const openEnded = createTestContext({ constraints: resolveConstraints({ isOpenEndAllowed: true }) });
      const event: RangeSelectionEvent = {
        type: 'range.set',
        range: { start: october(13), end: null },
        calendarId: 'gregory',
      };

      expect(rangeSelectionReducer(empty, event, closed)).toBe(empty);
      expect(rangeValue(rangeSelectionReducer(empty, event, openEnded), openEnded)).toEqual({
        start: '2026-10-13',
        end: null,
      });
    });

    it('commits only on confirm and restores on cancel in confirm mode', () => {
      const context = createTestContext({ commitMode: 'confirm' });
      const drafted = reduceEvents(rangeSelectionReducer, empty, [select(13), select(15)], context);

      expect(rangeValue(drafted, context)).toBeNull();
      expect(rangeValue(rangeSelectionReducer(drafted, { type: 'commit' }, context), context)).toEqual({
        start: '2026-10-13',
        end: '2026-10-15',
      });
      expect(displayedRange(rangeSelectionReducer(drafted, { type: 'cancel' }, context))).toBeNull();
    });

    it('commits an empty value after clearing', () => {
      const context = createTestContext({ commitMode: 'confirm' });
      const state = createRangeSelectionState({
        range: { start: october(13), end: october(15) },
        calendarId: 'gregory',
      });

      const cleared = rangeSelectionReducer(state, { type: 'clear' }, context);
      const committed = rangeSelectionReducer(cleared, { type: 'commit' }, context);

      expect(displayedRange(cleared)).toBeNull();
      expect(rangeValue(cleared, context)).toEqual({ start: '2026-10-13', end: '2026-10-15' });
      expect(rangeValue(committed, context)).toBeNull();
    });

    it('clears the value at once in immediate mode', () => {
      const context = createTestContext();
      const state = createRangeSelectionState({
        range: { start: october(13), end: october(15) },
        calendarId: 'gregory',
      });

      const cleared = rangeSelectionReducer(state, { type: 'clear' }, context);

      expect(displayedRange(cleared)).toBeNull();
      expect(rangeValue(cleared, context)).toBeNull();
    });

    it('does not commit a range that is still being selected', () => {
      const context = createTestContext({ commitMode: 'confirm' });
      const inProgress = rangeSelectionReducer(empty, select(13), context);

      expect(rangeSelectionReducer(inProgress, { type: 'commit' }, context)).toBe(inProgress);
    });
  });

  describe('open end', () => {
    const constraints = resolveConstraints({ isOpenEndAllowed: true });

    it('commits the start alone on confirm when open ends are allowed, matching its validity', () => {
      const context = createTestContext({ commitMode: 'confirm', constraints });
      const inProgress = rangeSelectionReducer(empty, select(13), context);

      const committed = rangeSelectionReducer(inProgress, { type: 'commit' }, context);

      expect(rangeValidity(inProgress, context).isValid).toBe(true);
      expect(rangeValue(committed, context)).toEqual({ start: '2026-10-13', end: null });
      expect(committed.anchor).toBeNull();
    });

    it('does not commit the first tap on its own in immediate mode', () => {
      const context = createTestContext({ constraints });
      const inProgress = rangeSelectionReducer(empty, select(13), context);

      expect(rangeValue(inProgress, context)).toBeNull();
      expect(rangeValue(rangeSelectionReducer(inProgress, { type: 'commit' }, context), context)).toEqual({
        start: '2026-10-13',
        end: null,
      });
    });
  });

  describe('external values', () => {
    const context = createTestContext();
    const reversed = { range: { start: october(17), end: october(11) }, calendarId: 'gregory' } as const;

    it('orders a reversed initial value', () => {
      const state = createRangeSelectionState(reversed);

      expect(displayedRange(state)).toEqual({ start: october(11), end: october(17) });
      expect(rangeValue(state, context)).toEqual({ start: '2026-10-11', end: '2026-10-17' });
    });

    it('orders a reversed synced value', () => {
      const state = rangeSelectionReducer(empty, { type: 'value.sync', selected: reversed }, context);

      expect(displayedRange(state)).toEqual({ start: october(11), end: october(17) });
      expect(rangeValue(state, context)).toEqual({ start: '2026-10-11', end: '2026-10-17' });
    });

    it('keeps the state reference when syncing the same range in reverse order', () => {
      const state = createRangeSelectionState({
        range: { start: october(11), end: october(17) },
        calendarId: 'gregory',
      });

      expect(rangeSelectionReducer(state, { type: 'value.sync', selected: reversed }, context)).toBe(state);
    });
  });

  it('carries the lunar annotation on both ends', () => {
    const context = createTestContext({ calendars: [gregory, dangi] });
    const events: RangeSelectionEvent[] = [
      { type: 'date.select', epochDay: october(13), calendarId: 'dangi' },
      { type: 'date.select', epochDay: october(15), calendarId: 'dangi' },
    ];

    expect(rangeValue(reduceEvents(rangeSelectionReducer, empty, events, context), context)).toEqual({
      start: '2026-10-13[u-ca=dangi]',
      end: '2026-10-15[u-ca=dangi]',
    });
  });

  it('reports an empty selection as incomplete', () => {
    expect(rangeValidity(empty, createTestContext()).reasons).toEqual(['incomplete']);
  });
});
