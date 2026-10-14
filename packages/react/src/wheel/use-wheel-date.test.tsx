import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { settleEffects } from '../testing/settle-effects';
import { type UseWheelDateProps, useWheelDate } from './use-wheel-date';

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

const readProbe = async (screen: Awaited<ReturnType<typeof render>>): Promise<ProbeSnapshot> => {
  const text = screen.getByRole('status').element().textContent ?? '{}';
  // as: 프로브가 그린 JSON은 ProbeSnapshot 모양임
  return JSON.parse(text) as ProbeSnapshot;
};

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
});
