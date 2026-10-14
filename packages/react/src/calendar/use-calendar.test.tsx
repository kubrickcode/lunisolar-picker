import type { CalendarId } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import type { MonthGridCell } from '@lunisolar-picker/core';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { epochDayAt, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { type CalendarApi, type UseCalendarProps, useCalendar } from './use-calendar';

// Constraint: 값 문자열의 날짜 부분은 역법과 무관하게 ISO 양력 날짜이고, 역법은 표기로만 붙음
const LUNAR_TODAY = `${FIXED_TODAY}[u-ca=dangi]`;

type ConfirmProbeProps = {
  readonly onClose: () => void;
  readonly onValueChange: UseCalendarProps['onValueChange'];
};

const renderCalendar = (initialProps: UseCalendarProps) =>
  renderHook((props?: UseCalendarProps) => useCalendar(props ?? {}), { initialProps, wrapper: KoreanProvider });

const ConfirmProbe = ({ onClose, onValueChange }: ConfirmProbeProps): ReactElement => {
  const calendar = useCalendar({ commitMode: 'confirm', onValueChange });
  return (
    <>
      <button type="button" onClick={() => calendar.selectEpochDay(epochDayAt('2026-10-20'))}>
        Pick
      </button>
      <button
        type="button"
        onClick={() => {
          calendar.commit();
          onClose();
        }}
      >
        Confirm
      </button>
    </>
  );
};

const ClosingConfirmProbe = ({ onValueChange }: Pick<ConfirmProbeProps, 'onValueChange'>): ReactElement => {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <ConfirmProbe onValueChange={onValueChange} onClose={() => setIsOpen(false)} /> : <p>Closed</p>;
};

const BlurProbe = ({ onBlur }: { readonly onBlur: () => void }): ReactElement => {
  const calendar = useCalendar({ onBlur });
  return (
    <>
      <div {...calendar.getRootProps()}>
        <input aria-label="Inside first" />
        <input aria-label="Inside second" />
      </div>
      <input aria-label="Outside" />
    </>
  );
};

describe('useCalendar', () => {
  describe('uncontrolled', () => {
    it('emits the selected date with its validity', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ defaultValue: null, onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));

      expect(result.current.value).toBe('2026-10-20');
      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
    });

    it('ignores a day rejected by isDateDisabled', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ isDateDisabled: (date) => date === '2026-10-20', onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));
      await settleEffects();

      expect(result.current.value).toBeNull();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('controlled', () => {
    it('returns to the parent value when the parent keeps it unchanged', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({ value: '2026-10-01', onValueChange });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));

      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
      expect(result.current.value).toBe('2026-10-01');
    });

    it('follows a new value from the parent without emitting a change', async () => {
      const onValueChange = vi.fn();
      const { result, rerender } = await renderCalendar({ value: '2026-10-01', onValueChange });

      await rerender({ value: '2026-11-11', onValueChange });
      await settleEffects();

      expect(result.current.value).toBe('2026-11-11');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('reports a non-canonical value and treats it as empty', async () => {
      const onInvalidValue = vi.fn();
      const { result } = await renderCalendar({ value: '2026-1-5', onInvalidValue });

      expect(result.current.value).toBeNull();
      expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5', 'invalid-date');
    });

    it('reports the same invalid value once while the parent re-renders with a new callback', async () => {
      const onInvalidValue = vi.fn();
      const { rerender } = await renderCalendar({
        value: '2026-1-5',
        onInvalidValue: (input, reason) => onInvalidValue(input, reason),
      });

      await rerender({ value: '2026-1-5', onInvalidValue: (input, reason) => onInvalidValue(input, reason) });
      await rerender({ value: '2026-1-5', onInvalidValue: (input, reason) => onInvalidValue(input, reason) });
      await settleEffects();

      expect(onInvalidValue).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirm mode', () => {
    it('keeps the committed value until commit and restores it on cancel', async () => {
      const onValueChange = vi.fn();
      const { result, act } = await renderCalendar({
        defaultValue: '2026-10-01',
        commitMode: 'confirm',
        onValueChange,
      });

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-20')));
      expect(result.current.value).toBe('2026-10-01');
      expect(result.current.getCellState(cellOf(result.current, '2026-10-20')).isSelected).toBe(true);

      await act(() => result.current.cancel());
      expect(result.current.getCellState(cellOf(result.current, '2026-10-01')).isSelected).toBe(true);

      await act(() => result.current.selectEpochDay(epochDayAt('2026-10-21')));
      await act(() => result.current.commit());
      expect(result.current.value).toBe('2026-10-21');
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('reports the confirmed value even when the calendar closes in the same click', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ClosingConfirmProbe onValueChange={onValueChange} />, { wrapper: KoreanProvider });

      await screen.getByRole('button', { name: 'Pick' }).click();
      await screen.getByRole('button', { name: 'Confirm' }).click();

      await expect.element(screen.getByText('Closed')).toBeVisible();
      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', { validity: { isValid: true, reasons: [] } });
    });
  });

  describe('display calendar', () => {
    it('opens in the calendar of the value when no display calendar is given', async () => {
      const { result } = await renderCalendar({ calendars: [dangi], defaultValue: LUNAR_TODAY });

      expect(result.current.navigation.displayCalendarId).toBe('dangi');
    });

    it('keeps the requested default display calendar over the calendar of the value', async () => {
      const { result } = await renderCalendar({
        calendars: [dangi],
        defaultValue: LUNAR_TODAY,
        defaultDisplayCalendar: 'gregory',
      });

      expect(result.current.navigation.displayCalendarId).toBe('gregory');
    });

    it('shows the solar calendar when the requested display calendar was not provided', async () => {
      const { result } = await renderCalendar({ displayCalendar: 'dangi' });

      expect(result.current.navigation.displayCalendarId).toBe('gregory');
      expect(result.current.calendar.id).toBe('gregory');
    });

    it('returns to the parent display calendar when the parent keeps it unchanged', async () => {
      const onDisplayCalendarChange = vi.fn<(calendarId: CalendarId) => void>();
      const { result, act } = await renderCalendar({
        calendars: [dangi],
        displayCalendar: 'gregory',
        onDisplayCalendarChange,
      });

      await act(() => result.current.selectDisplayCalendar('dangi'));

      expect(onDisplayCalendarChange).toHaveBeenCalledWith('dangi');
      expect(result.current.navigation.displayCalendarId).toBe('gregory');
    });
  });

  describe('calendars removed by the app', () => {
    it('rewrites an uncontrolled lunar value in the solar calendar without callbacks', async () => {
      const onValueChange = vi.fn();
      const onDisplayCalendarChange = vi.fn();
      const { result, rerender } = await renderCalendar({
        calendars: [dangi],
        defaultValue: LUNAR_TODAY,
        onValueChange,
        onDisplayCalendarChange,
      });

      await rerender({ calendars: [], defaultValue: LUNAR_TODAY, onValueChange, onDisplayCalendarChange });
      await settleEffects();

      expect(result.current.value).toBe(FIXED_TODAY);
      expect(result.current.navigation.displayCalendarId).toBe('gregory');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onDisplayCalendarChange).not.toHaveBeenCalled();
    });

    it('empties a controlled lunar value and reports it as invalid without a value change', async () => {
      const onValueChange = vi.fn();
      const onInvalidValue = vi.fn();
      const { result, rerender } = await renderCalendar({
        calendars: [dangi],
        value: LUNAR_TODAY,
        onValueChange,
        onInvalidValue,
      });

      await rerender({ calendars: [], value: LUNAR_TODAY, onValueChange, onInvalidValue });
      await settleEffects();

      expect(result.current.value).toBeNull();
      expect(onInvalidValue).toHaveBeenCalledWith(LUNAR_TODAY, expect.any(String));
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('validity', () => {
    it('does not look invalid while a required calendar is still empty', async () => {
      const { result } = await renderCalendar({ required: true });

      expect(result.current.validity.isValid).toBe(false);
      expect(result.current.isInvalid).toBe(false);
    });

    it('looks invalid when the parent value breaks a constraint', async () => {
      const { result } = await renderCalendar({ value: '2026-10-20', max: '2026-10-15' });

      expect(result.current.validity.reasons).toEqual(['after-max']);
      expect(result.current.isInvalid).toBe(true);
    });
  });

  it('reports onBlur once when focus leaves the whole calendar', async () => {
    const onBlur = vi.fn();
    const screen = await render(<BlurProbe onBlur={onBlur} />, { wrapper: KoreanProvider });

    await clickToFocus(screen.getByRole('textbox', { name: 'Inside first' }));
    await clickToFocus(screen.getByRole('textbox', { name: 'Inside second' }));
    await settleEffects();
    expect(onBlur).not.toHaveBeenCalled();
    await clickToFocus(screen.getByRole('textbox', { name: 'Outside' }));

    await expect.poll(() => onBlur.mock.calls.length).toBe(1);
  });

  it('opens on the month of today when there is no value', async () => {
    const { result } = await renderCalendar({});

    expect(result.current.navigation.focusedEpochDay).toBe(epochDayAt(FIXED_TODAY));
    expect(result.current.months).toHaveLength(1);
  });

  it('builds one grid per requested month', async () => {
    const { result } = await renderCalendar({ numberOfMonths: 2 });

    expect(result.current.months.map((month) => month.month.monthCode)).toEqual(['M10', 'M11']);
  });
});

const cellOf = (api: CalendarApi, isoDate: string): MonthGridCell => {
  const cell = api.months
    .flatMap((month) => month.weeks.flat())
    .find((candidate) => candidate.date === isoDate && !candidate.isOutsideMonth);
  if (!cell) throw new Error(`${isoDate} is not visible`);
  return cell;
};
