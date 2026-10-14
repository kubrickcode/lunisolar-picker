import { dangi } from '@lunisolar-picker/calendar/dangi';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { dispatchMousePointer } from '../testing/dispatch-mouse-pointer';
import { renderWithHydration } from '../testing/expect-hydration';
import { formElementOf } from '../testing/form-element';
import { settleEffects } from '../testing/settle-effects';
import * as Wheel from './parts';
import { type UseWheelDateProps, useWheelDate } from './use-wheel-date';

// Constraint: 부정 단언 전에 정착 애니메이션(220ms)과 그 뒤 알림까지 끝날 시간을 넉넉히 기다림
const SNAP_WAIT_MILLISECONDS = 600;
const TODAY_CHECK_INTERVAL_MILLISECONDS = 60_000;

type ControlledProbeProps = Omit<UseWheelDateProps, 'value'> & {
  readonly initialValue: string | null;
  readonly resetValue?: string | null | undefined;
};

type ProbeSnapshot = {
  readonly entryCalendarId: string;
  readonly fields: unknown;
  readonly value: string | null;
  readonly yearCount: number;
};

const WheelDateProbe = (props: UseWheelDateProps) => {
  const wheelDate = useWheelDate(props);
  const snapshot: ProbeSnapshot = {
    entryCalendarId: wheelDate.entryCalendarId,
    fields: wheelDate.fields,
    value: wheelDate.value,
    yearCount: wheelDate.columns.years.length,
  };
  return (
    <>
      <output>{JSON.stringify(snapshot)}</output>
      <button type="button" onClick={() => wheelDate.selectYear(1991)}>
        1991
      </button>
      <button type="button" onClick={() => wheelDate.selectMonth('M02')}>
        February
      </button>
      <button type="button" onClick={() => wheelDate.selectDay(20)}>
        Day 20
      </button>
      <button type="button" onClick={() => wheelDate.setEntryCalendar('dangi')}>
        Lunar
      </button>
    </>
  );
};

const ControlledProbe = ({ initialValue, resetValue = null, onValueChange, ...props }: ControlledProbeProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <WheelDateProbe
        {...props}
        value={value}
        onValueChange={(next, details) => {
          setValue(next);
          onValueChange?.(next, details);
        }}
      />
      <button type="button" onClick={() => setValue(resetValue)}>
        Reset
      </button>
    </>
  );
};

// Goal: 앱(M4)이 하듯 useWheelDate 결과로 Wheel 부품을 그림. 상태 prop 전파·폼 연결을 실제 열로 검증함
const WheelDateColumns = (props: UseWheelDateProps) => {
  const wheelDate = useWheelDate(props);
  return (
    <>
      <Wheel.Root aria-label="Date" {...wheelDate.getRootProps()}>
        <Wheel.Column
          label={wheelDate.labels.year}
          options={wheelDate.columns.years}
          value={wheelDate.fields.year}
          onValueChange={wheelDate.selectYear}
        />
        <Wheel.Column
          label={wheelDate.labels.month}
          options={wheelDate.columns.months}
          value={wheelDate.fields.monthCode}
          onValueChange={wheelDate.selectMonth}
        />
        <Wheel.Column
          label={wheelDate.labels.day}
          options={wheelDate.columns.days}
          value={wheelDate.fields.day}
          onValueChange={wheelDate.selectDay}
        />
        <Wheel.HiddenInput {...wheelDate.getHiddenInputProps()} />
      </Wheel.Root>
      <output>{wheelDate.value ?? 'none'}</output>
    </>
  );
};

const waitForSnap = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, SNAP_WAIT_MILLISECONDS));

const parseSnapshot = (text: string | null | undefined): ProbeSnapshot =>
  // as: 프로브가 그린 JSON은 ProbeSnapshot 모양임
  JSON.parse(text ?? '{}') as ProbeSnapshot;

const readProbe = async (screen: Awaited<ReturnType<typeof render>>): Promise<ProbeSnapshot> =>
  parseSnapshot(screen.getByRole('status').element().textContent);

describe('useWheelDate', () => {
  describe('selection', () => {
    it('replaces a leap month that disappears in the new year with its regular month', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelDateProbe
          locale={ko}
          calendars={[dangi]}
          defaultValue="1990-06-23[u-ca=dangi]"
          onValueChange={onValueChange}
        />,
      );
      expect((await readProbe(screen)).fields).toEqual({ year: 1990, monthCode: 'M05L', day: 1 });

      await screen.getByRole('button', { name: '1991' }).click();

      await expect.poll(async () => (await readProbe(screen)).fields).toEqual({ year: 1991, monthCode: 'M05', day: 1 });
      expect(onValueChange.mock.calls.at(-1)?.[0]).toMatch(/\[u-ca=dangi\]$/);
    });

    it('moves day 31 to the last day of a shorter Gregorian month', async () => {
      const screen = await render(<WheelDateProbe defaultValue="2026-01-31" />);

      await screen.getByRole('button', { name: 'February' }).click();

      await expect.poll(async () => (await readProbe(screen)).value).toBe('2026-02-28');
    });

    it('starts the wheels from today clamped to the constraints without reporting a value', async () => {
      const screen = await render(<WheelDateProbe today="2026-10-14" max="2026-01-01" />);

      const snapshot = await readProbe(screen);
      expect(snapshot.fields).toEqual({ year: 2026, monthCode: 'M01', day: 1 });
      expect(snapshot.value).toBeNull();
    });

    it('commits the shown date on the first selection when there was no value', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<WheelDateProbe today="2026-10-14" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Day 20' }).click();

      await expect
        .poll(() => onValueChange.mock.calls)
        .toEqual([['2026-10-20', { validity: { isValid: true, reasons: [] } }]]);
    });

    it('renders empty wheels instead of throwing when the constraints lie outside the entry calendar', async () => {
      const screen = await render(
        <WheelDateProbe calendars={[dangi]} defaultEntryCalendar="dangi" max="1800-01-01" today="2026-10-14" />,
      );

      const snapshot = await readProbe(screen);
      expect(snapshot.yearCount).toBe(0);
      expect(snapshot.value).toBeNull();
    });

    it('keeps a present value without a callback when the constraints lie outside its calendar', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelDateProbe
          calendars={[dangi]}
          value="1990-06-23[u-ca=dangi]"
          max="1800-01-01"
          onValueChange={onValueChange}
        />,
      );
      await settleEffects();

      const snapshot = await readProbe(screen);
      expect(snapshot.value).toBe('1990-06-23[u-ca=dangi]');
      expect(snapshot.yearCount).toBe(0);
      expect(onValueChange.mock.calls).toEqual([]);
    });
  });

  describe('calendar', () => {
    it('keeps the value calendar over the entry calendar prop and stays silent on mount', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <WheelDateProbe
          calendars={[dangi]}
          value="1990-06-23[u-ca=dangi]"
          entryCalendar="gregory"
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        />,
      );
      await settleEffects();

      const snapshot = await readProbe(screen);
      expect(snapshot.entryCalendarId).toBe('dangi');
      expect(snapshot.fields).toEqual({ year: 1990, monthCode: 'M05L', day: 1 });
      expect(onValueChange.mock.calls).toEqual([]);
      expect(onEntryCalendarChange.mock.calls).toEqual([]);
    });

    it('applies the default entry calendar when there is no value', async () => {
      const screen = await render(
        <WheelDateProbe calendars={[dangi]} defaultEntryCalendar="dangi" today="2026-10-14" />,
      );

      const snapshot = await readProbe(screen);
      expect(snapshot.entryCalendarId).toBe('dangi');
      expect(snapshot.fields).toEqual({ year: 2026, monthCode: 'M09', day: 4 });
    });

    it('re-expresses the value in the calendar the user switches to and reports both changes', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <WheelDateProbe
          calendars={[dangi]}
          defaultValue="2026-10-14"
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        />,
      );

      await screen.getByRole('button', { name: 'Lunar' }).click();

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-14[u-ca=dangi]');
      expect(onEntryCalendarChange.mock.calls).toEqual([['dangi']]);
    });

    it('re-expresses the value when the parent changes the entry calendar prop, without a calendar callback', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const props = { calendars: [dangi], defaultValue: '2026-10-14', onValueChange, onEntryCalendarChange };
      const screen = await render(<WheelDateProbe {...props} entryCalendar="gregory" />);

      await screen.rerender(<WheelDateProbe {...props} entryCalendar="dangi" />);

      await expect.poll(() => onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-14[u-ca=dangi]']);
      expect(onEntryCalendarChange.mock.calls).toEqual([]);
    });
  });

  describe('controlled value', () => {
    it('reports nothing for a controlled null value and reports the first user selection', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <ControlledProbe initialValue={null} today="2026-10-14" onValueChange={onValueChange} />,
      );
      await settleEffects();
      expect((await readProbe(screen)).value).toBeNull();
      expect(onValueChange.mock.calls).toEqual([]);

      await screen.getByRole('button', { name: 'Day 20' }).click();

      await expect.poll(() => onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-20']);
    });

    it('keeps the wheel position when the parent clears the value, without reporting it', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ControlledProbe initialValue="2026-03-05" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.poll(async () => (await readProbe(screen)).value).toBeNull();
      await settleEffects();
      expect((await readProbe(screen)).fields).toEqual({ year: 2026, monthCode: 'M03', day: 5 });
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('shows a parent-supplied value without reporting it', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <ControlledProbe initialValue="2026-03-05" resetValue="2027-07-07" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.poll(async () => (await readProbe(screen)).value).toBe('2027-07-07');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('reports a user change once and not the parent echo', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ControlledProbe initialValue="2026-03-05" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Day 20' }).click();
      await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
      await settleEffects();

      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-03-20']);
    });

    it('keeps a parent value outside the constraints and reports its real validity on the next change', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <ControlledProbe
          calendars={[dangi]}
          initialValue="2026-10-14"
          max="2026-01-01"
          onValueChange={onValueChange}
        />,
      );
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);

      await screen.getByRole('button', { name: 'Lunar' }).click();

      await expect
        .poll(() => onValueChange.mock.calls)
        .toEqual([['2026-10-14[u-ca=dangi]', { validity: { isValid: false, reasons: ['after-max'] } }]]);
    });
  });
  describe('state props', () => {
    it('keeps a disabled wheel still on drag and keys', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelDateColumns disabled defaultValue="1990-03-15" today="2026-10-14" onValueChange={onValueChange} />,
      );
      const yearColumn = screen.getByRole('spinbutton', { name: en.labels.year }).element();
      const item = screen.getByText('1991').element();
      const { height, top } = item.getBoundingClientRect();

      yearColumn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      await waitForSnap();
      // Constraint: 버튼 없는 move로 끝내 관성 없이 220ms 정착으로 끝나게 함. pointerup은 빠른 합성 이벤트를 큰 속도로 읽어 정착이 대기 시간보다 길어짐
      dispatchMousePointer(item, 'pointerdown', { button: 0, buttons: 1, clientY: top + height / 2 });
      dispatchMousePointer(document, 'pointermove', { buttons: 1, clientY: top - height * 3 });
      dispatchMousePointer(document, 'pointermove', { buttons: 0, clientY: top - height * 3 });
      await waitForSnap();

      await expect.element(screen.getByRole('status')).toHaveTextContent('1990-03-15');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('keeps a read-only wheel focusable but unchanged', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelDateColumns readOnly defaultValue="1990-03-15" today="2026-10-14" onValueChange={onValueChange} />,
      );
      const yearColumn = screen.getByRole('spinbutton', { name: en.labels.year });
      yearColumn.element().focus();
      await expect.element(yearColumn).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      await waitForSnap();

      await expect.element(yearColumn).toHaveAttribute('aria-readonly', 'true');
      await expect.element(screen.getByRole('status')).toHaveTextContent('1990-03-15');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('reports onBlur once when focus leaves the whole wheel, not between columns', async () => {
      const onBlur = vi.fn();
      const screen = await render(
        <>
          <WheelDateColumns defaultValue="1990-03-15" today="2026-10-14" onBlur={onBlur} />
          <button type="button">Next field</button>
        </>,
      );
      const yearColumn = screen.getByRole('spinbutton', { name: en.labels.year });
      yearColumn.element().focus();
      await expect.element(yearColumn).toHaveFocus();
      await userEvent.keyboard('{Tab}');
      await expect.element(screen.getByRole('spinbutton', { name: en.labels.month })).toHaveFocus();
      expect(onBlur).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: 'Next field' }).click();

      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });
  });

  describe('form', () => {
    it('submits the committed value under its name', async () => {
      const screen = await render(
        <form aria-label="Profile">
          <WheelDateColumns name="birthDate" defaultValue="1990-03-15" today="2026-10-14" />
        </form>,
      );

      expect(new FormData(formElementOf(screen.getByRole('form'))).get('birthDate')).toBe('1990-03-15');
    });

    it('restores the default value when the form resets', async () => {
      const screen = await render(
        <form aria-label="Profile">
          <WheelDateColumns name="birthDate" defaultValue="1990-03-15" today="2026-10-14" />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form'));
      const dayColumn = screen.getByRole('spinbutton', { name: en.labels.day });
      dayColumn.element().focus();
      await expect.element(dayColumn).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      await expect.poll(() => new FormData(form).get('birthDate')).toBe('1990-03-16');

      form.reset();

      await expect.poll(() => new FormData(form).get('birthDate')).toBe('1990-03-15');
      await expect.element(screen.getByRole('status')).toHaveTextContent('1990-03-15');
    });
  });

  describe('calendars', () => {
    it('falls back to the Gregorian calendar when the entry calendar is removed', async () => {
      const screen = await render(
        <WheelDateProbe calendars={[dangi]} defaultValue="1990-06-23[u-ca=dangi]" today="2026-10-14" />,
      );

      await screen.rerender(<WheelDateProbe defaultValue="1990-06-23[u-ca=dangi]" today="2026-10-14" />);

      const snapshot = await readProbe(screen);
      expect(snapshot.entryCalendarId).toBe('gregory');
      expect(snapshot.fields).toEqual({ year: 1990, monthCode: 'M06', day: 23 });
    });
  });

  describe('hydration', () => {
    it('hydrates the wheel columns without a mismatch', async () => {
      const { recoverableErrors, unmount } = await renderWithHydration(
        <WheelDateColumns defaultValue="1990-03-15" today="2026-10-14" />,
      );

      expect(recoverableErrors).toEqual([]);
      unmount();
    });

    it('follows the current day after hydration while nothing is selected', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      try {
        vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
        const { container, recoverableErrors, unmount } = await renderWithHydration(<WheelDateProbe />);
        expect(recoverableErrors).toEqual([]);

        vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
        await vi.advanceTimersByTimeAsync(TODAY_CHECK_INTERVAL_MILLISECONDS);

        await expect
          .poll(() => parseSnapshot(container.querySelector('output')?.textContent).fields)
          .toEqual({ year: 2026, monthCode: 'M10', day: 14 });
        unmount();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
