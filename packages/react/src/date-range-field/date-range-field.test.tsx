import { dangi } from '@lunisolar-picker/calendar/dangi';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { settleEffects } from '../testing/settle-effects';
import type { DateRangeInput } from '../value/parse-controlled-value';
import * as DateRangeField from './parts';

const GREGORY_RANGE: DateRangeInput = { start: '2026-10-13', end: '2026-10-17' };

describe('DateRangeField', () => {
  it('moves from the completed start date to the end date while typing', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101320261017');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
  });

  it('moves to the end date only after the last English segment, the year, is complete', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="Period" locale={en} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: en.labels.month }).first().click();
    await userEvent.keyboard('1013202610172026');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
  });

  it('swaps a reversed range so the start never comes after the end', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101720261013');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
  });

  it('emits an open-ended range only when an open end is allowed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateRangeField.Root aria-label="기간" locale={ko} isOpenEndAllowed onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20261013');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: null });
  });

  it('flags a range longer than maxDays without changing it', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateRangeField.Root aria-label="기간" locale={ko} maxDays={3} limitMode="flag" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101320261017');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('range-too-long');
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-13', end: '2026-10-17' });
    await expect.element(screen.getByRole('group', { name: '기간' })).toHaveAttribute('data-invalid', '');
  });

  it('does not mark an untouched empty range as invalid', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await expect.element(screen.getByRole('group', { name: '기간' })).not.toHaveAttribute('data-invalid');
  });

  it('reports leaving the whole range once, not the move from start to end', async () => {
    const onBlur = vi.fn();
    const screen = await render(
      <>
        <DateRangeField.Root aria-label="기간" locale={ko} onBlur={onBlur} />
        <button type="button">Next</button>
      </>,
    );
    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20261013');
    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).last()).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: 'Next' }).click();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  describe('form', () => {
    it('submits each end under its own name', async () => {
      const screen = await render(
        <form aria-label="Report">
          <DateRangeField.Root
            aria-label="기간"
            locale={ko}
            startName="from"
            endName="to"
            defaultValue={GREGORY_RANGE}
          />
        </form>,
      );
      // as: getByRole('form')로 고른 요소는 form 요소임
      const formData = new FormData(screen.getByRole('form').element() as HTMLFormElement);

      expect([formData.get('from'), formData.get('to')]).toEqual(['2026-10-13', '2026-10-17']);
    });

    it('requires the end input only when an open end is not allowed', async () => {
      const screen = await render(
        <DateRangeField.Root aria-label="기간" locale={ko} required isOpenEndAllowed startName="from" endName="to" />,
      );

      expect(screen.container.querySelector('input[name="from"]')?.hasAttribute('required')).toBe(true);
      expect(screen.container.querySelector('input[name="to"]')?.hasAttribute('required')).toBe(false);
    });
  });

  describe('entry calendar', () => {
    it('keeps the calendar of a controlled range over entryCalendar on mount without callbacks', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          calendars={[dangi]}
          value={GREGORY_RANGE}
          entryCalendar="dangi"
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        />,
      );

      await expect.element(screen.getByRole('group', { name: '기간' })).toHaveAttribute('data-calendar', 'gregory');
      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeEnd }))
        .toHaveAttribute('data-calendar', 'gregory');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onEntryCalendarChange).not.toHaveBeenCalled();
    });

    it('enters both ends in defaultEntryCalendar when the range is empty', async () => {
      const screen = await render(
        <DateRangeField.Root aria-label="기간" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" />,
      );

      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeStart }))
        .toHaveAttribute('data-calendar', 'dangi');
      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeEnd }))
        .toHaveAttribute('data-calendar', 'dangi');
    });

    it('switches both ends to the calendar of a controlled range without reporting it back', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const Controlled = () => {
        const [value, setValue] = useState<DateRangeInput>(GREGORY_RANGE);
        return (
          <>
            <DateRangeField.Root
              aria-label="기간"
              locale={ko}
              calendars={[dangi]}
              value={value}
              onValueChange={onValueChange}
              onEntryCalendarChange={onEntryCalendarChange}
            />
            <button
              type="button"
              onClick={() => setValue({ start: '1990-06-23[u-ca=dangi]', end: '1990-06-25[u-ca=dangi]' })}
            >
              Lunar range
            </button>
          </>
        );
      };
      const screen = await render(<Controlled />);

      await screen.getByRole('button', { name: 'Lunar range' }).click();

      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeStart }))
        .toHaveAttribute('data-calendar', 'dangi');
      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeEnd }))
        .toHaveAttribute('data-calendar', 'dangi');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onEntryCalendarChange).not.toHaveBeenCalled();
    });

    it('re-annotates the range when the parent changes entryCalendar while a value is present', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          calendars={[dangi]}
          defaultValue={GREGORY_RANGE}
          entryCalendar="gregory"
          onValueChange={onValueChange}
        />,
      );

      await screen.rerender(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          calendars={[dangi]}
          defaultValue={GREGORY_RANGE}
          entryCalendar="dangi"
          onValueChange={onValueChange}
        />,
      );

      await expect
        .poll(() => onValueChange.mock.calls.at(-1)?.[0])
        .toEqual({ start: '2026-10-13[u-ca=dangi]', end: '2026-10-17[u-ca=dangi]' });
    });
  });

  it('has no accessibility violations', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await expectNoAxeViolations(screen.container);
  });
});
