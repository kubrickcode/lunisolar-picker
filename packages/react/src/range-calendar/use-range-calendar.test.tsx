import { dangi } from '@lunisolar-picker/calendar/dangi';
import { type MonthGridCell, VALID } from '@lunisolar-picker/core';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { epochDayAt, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { type RangeCalendarApi, type UseRangeCalendarProps, useRangeCalendar } from './use-range-calendar';

const LUNAR_RANGE = { start: '2026-10-13[u-ca=dangi]', end: '2026-10-17[u-ca=dangi]' } as const;

type ClosingProbeProps = {
  readonly onClose: () => void;
  readonly onValueChange: UseRangeCalendarProps['onValueChange'];
};

const renderRangeCalendar = (initialProps: UseRangeCalendarProps) =>
  renderHook((props?: UseRangeCalendarProps) => useRangeCalendar(props ?? {}), {
    initialProps,
    wrapper: KoreanProvider,
  });

const ClosingProbe = ({ onClose, onValueChange }: ClosingProbeProps): ReactElement => {
  const calendar = useRangeCalendar({ onValueChange });
  return (
    <>
      <button type="button" onClick={() => calendar.selectEpochDay(epochDayAt('2026-10-13'))}>
        Pick start
      </button>
      <button
        type="button"
        onClick={() => {
          calendar.selectEpochDay(epochDayAt('2026-10-17'));
          onClose();
        }}
      >
        Pick end and close
      </button>
    </>
  );
};

const ClosableRangeCalendar = ({ onValueChange }: Omit<ClosingProbeProps, 'onClose'>): ReactElement => {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <ClosingProbe onValueChange={onValueChange} onClose={() => setIsOpen(false)} /> : <p>Closed</p>;
};

describe('useRangeCalendar', () => {
  it('rejects a single name prop because the range submits through startName and endName', () => {
    // @ts-expect-error: 범위 훅은 name을 받지 않음 (계약 §3.4)
    const props: UseRangeCalendarProps = { name: 'stay' };

    expect(props).toEqual({ name: 'stay' });
  });

  describe('immediate mode', () => {
    it('reports the completed range once even when the calendar closes in the same click', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ClosableRangeCalendar onValueChange={onValueChange} />, {
        wrapper: KoreanProvider,
      });

      await screen.getByRole('button', { name: 'Pick start' }).click();
      await screen.getByRole('button', { name: 'Pick end and close' }).click();
      await expect.element(screen.getByText('Closed')).toBeVisible();
      await settleEffects();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
    });

    it('clears the range through setRange(null) and reports it', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderRangeCalendar({
        defaultValue: { start: '2026-10-13', end: '2026-10-17' },
        onValueChange,
      });

      await act(() => result.current.setRange(null));

      expect(result.current.value).toBeNull();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(null, { validity: VALID });
    });

    it('reports an unreadable preset and keeps the current range', async () => {
      const onValueChange = vi.fn();
      const onInvalidValue = vi.fn();
      const { result, act } = await renderRangeCalendar({
        defaultValue: { start: '2026-10-13', end: '2026-10-17' },
        onValueChange,
        onInvalidValue,
      });

      await act(() => result.current.setRange({ start: '2026-1-5', end: '2026-10-17' }));
      await settleEffects();

      expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5/2026-10-17', 'invalid-date');
      expect(result.current.value).toEqual({ start: '2026-10-13', end: '2026-10-17' });
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('presets', () => {
    it('keeps focus where it was when the store refuses the preset', async () => {
      const { result, act } = await renderRangeCalendar({});

      await act(() => result.current.setRange({ start: '2026-11-20', end: null }));

      expect(result.current.draftValue).toBeNull();
      expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt(FIXED_TODAY));
    });

    it('moves focus to the start of an accepted preset', async () => {
      const { result, act } = await renderRangeCalendar({});

      await act(() => result.current.setRange({ start: '2026-11-20', end: '2026-11-22' }));

      expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt('2026-11-20'));
    });
  });

  describe('selected cells', () => {
    it('exposes the span from the anchor to the hovered day as selected while choosing', async () => {
      const { result, act } = await renderRangeCalendar({});

      await act(() =>
        result.current.sendSelection({
          type: 'pointer.down',
          epochDay: epochDayAt('2026-10-13'),
          calendarId: 'gregory',
        }),
      );
      await act(() => result.current.sendSelection({ type: 'pointer.enter', epochDay: epochDayAt('2026-10-15') }));

      const ariaSelectedOf = (isoDate: string) =>
        result.current.getCellProps(cellOf(result.current, isoDate)).gridCell['aria-selected'];
      expect(ariaSelectedOf('2026-10-14')).toBe(true);
      expect(ariaSelectedOf('2026-10-16')).toBe(false);
    });
  });

  describe('read-only', () => {
    it('ignores a preset range', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderRangeCalendar({
        readOnly: true,
        defaultValue: { start: '2026-10-13', end: '2026-10-17' },
        onValueChange,
      });

      await act(() => result.current.setRange({ start: '2026-10-01', end: '2026-10-03' }));
      await settleEffects();

      expect(result.current.value).toEqual({ start: '2026-10-13', end: '2026-10-17' });
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('confirm mode', () => {
    it('exposes the unconfirmed draft and its validity before commit', async () => {
      const { result, act } = await renderRangeCalendar({ commitMode: 'confirm', maxDays: 3, limitMode: 'flag' });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-01')));
      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-10')));

      expect(result.current.value).toBeNull();
      expect(result.current.draftValue).toEqual({ start: '2026-10-01', end: '2026-10-10' });
      expect(result.current.validity.reasons).toEqual(['range-too-long']);
    });
  });

  describe('block mode', () => {
    it('disables days beyond the limit while an end handle is grabbed', async () => {
      const { result, act } = await renderRangeCalendar({
        defaultValue: { start: '2026-10-13', end: '2026-10-15' },
        maxDays: 3,
        limitMode: 'block',
      });

      await act(() => result.current.sendSelection({ type: 'handle.grab', handle: 'end' }));

      expect(result.current.getCellState(cellOf(result.current, '2026-10-16')).isDisabled).toBe(true);
      expect(result.current.getCellState(cellOf(result.current, '2026-10-15')).isDisabled).toBe(false);
    });
  });

  describe('controlled', () => {
    it('returns to the parent range when the parent keeps it unchanged', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderRangeCalendar({
        value: { start: '2026-10-01', end: '2026-10-03' },
        onValueChange,
      });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-13')));
      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-17')));
      await settleEffects();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
      expect(result.current.value).toEqual({ start: '2026-10-01', end: '2026-10-03' });
    });

    it('follows a new range from the parent without emitting a change', async () => {
      const onValueChange = vi.fn();
      const { result, rerender } = await renderRangeCalendar({
        value: { start: '2026-10-01', end: '2026-10-03' },
        onValueChange,
      });

      await rerender({ value: { start: '2026-11-11', end: '2026-11-12' }, onValueChange });
      await settleEffects();

      expect(result.current.value).toEqual({ start: '2026-11-11', end: '2026-11-12' });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('opens on today in the solar calendar when the parent range is empty, ignoring defaultValue', async () => {
      const { result } = await renderRangeCalendar({ calendars: [dangi], value: null, defaultValue: LUNAR_RANGE });

      expect(result.current.value).toBeNull();
      expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt(FIXED_TODAY));
      expect(result.current.navigation.displayCalendarId).toBe('gregory');
    });

    it('reports an unreadable range once while the parent re-renders with a new callback', async () => {
      const onInvalidValue = vi.fn();
      const value = { start: '2026-1-5', end: '2026-10-17' };
      const { result, rerender } = await renderRangeCalendar({
        value,
        onInvalidValue: (input, reason) => onInvalidValue(input, reason),
      });

      await rerender({ value: { ...value }, onInvalidValue: (input, reason) => onInvalidValue(input, reason) });
      await settleEffects();

      expect(result.current.value).toBeNull();
      expect(onInvalidValue).toHaveBeenCalledTimes(1);
      expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5/2026-10-17', 'invalid-date');
    });
  });

  describe('display calendar', () => {
    it('opens in the calendar of the range start when no display calendar is given', async () => {
      const { result } = await renderRangeCalendar({ calendars: [dangi], defaultValue: LUNAR_RANGE });

      expect(result.current.navigation.displayCalendarId).toBe('dangi');
      expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt('2026-10-13'));
    });
  });

  describe('calendars removed by the app', () => {
    it('rewrites an uncontrolled lunar range in the solar calendar without callbacks', async () => {
      const onValueChange = vi.fn();
      const { result, rerender } = await renderRangeCalendar({
        calendars: [dangi],
        defaultValue: LUNAR_RANGE,
        onValueChange,
      });

      await rerender({ calendars: [], defaultValue: LUNAR_RANGE, onValueChange });
      await settleEffects();

      expect(result.current.value).toEqual({ start: '2026-10-13', end: '2026-10-17' });
      expect(result.current.navigation.displayCalendarId).toBe('gregory');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('continues a lunar range started before the calendar was removed in the solar calendar', async () => {
      const onValueChange = vi.fn();
      const { result, rerender, act } = await renderRangeCalendar({ calendars: [dangi], displayCalendar: 'dangi' });
      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-13')));

      await rerender({ calendars: [], displayCalendar: 'dangi', onValueChange });
      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-17')));

      expect(result.current.value).toEqual({ start: '2026-10-13', end: '2026-10-17' });
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
    });

    it('empties a controlled lunar range and reports it as invalid without a value change', async () => {
      const onValueChange = vi.fn();
      const onInvalidValue = vi.fn();
      const { result, rerender } = await renderRangeCalendar({
        calendars: [dangi],
        value: LUNAR_RANGE,
        onValueChange,
        onInvalidValue,
      });

      await rerender({ calendars: [], value: LUNAR_RANGE, onValueChange, onInvalidValue });
      await settleEffects();

      expect(result.current.value).toBeNull();
      expect(onInvalidValue).toHaveBeenCalledWith(`${LUNAR_RANGE.start}/${LUNAR_RANGE.end}`, expect.any(String));
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});

const cellOf = (api: RangeCalendarApi, isoDate: string): MonthGridCell => {
  const cell = api.months
    .flatMap((month) => month.weeks.flat())
    .find((candidate) => candidate.date === isoDate && !candidate.isOutsideMonth);
  if (!cell) throw new Error(`${isoDate} is not visible`);
  return cell;
};
