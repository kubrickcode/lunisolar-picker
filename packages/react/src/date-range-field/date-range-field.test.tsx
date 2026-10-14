import { dangi } from '@lunisolar-picker/calendar/dangi';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderWithHydration } from '../testing/expect-hydration';
import { settleEffects } from '../testing/settle-effects';
import type { DateRangeInput } from '../value/parse-controlled-value';
import { useDateRangeFieldContext } from './date-range-field-context';
import * as DateRangeField from './parts';

const GREGORY_RANGE: DateRangeInput = { start: '2026-10-13', end: '2026-10-17' };

type ResettingParentProps = {
  readonly initialValue: DateRangeInput;
  readonly pushedValue?: DateRangeInput | undefined;
};

const ResettingParent = ({ initialValue, pushedValue }: ResettingParentProps) => {
  const [value, setValue] = useState<DateRangeInput | null>(initialValue);
  return (
    <>
      <DateRangeField.Root aria-label="기간" locale={ko} value={value} onValueChange={setValue} />
      <button type="button" onClick={() => setValue(pushedValue ?? null)}>
        Push
      </button>
      <button type="button" onClick={() => setValue(null)}>
        Reset
      </button>
    </>
  );
};

const LunarEntryButton = () => {
  const range = useDateRangeFieldContext();
  return (
    <button type="button" onClick={() => range.setEntryCalendar('dangi')}>
      Lunar entry
    </button>
  );
};

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

  it('swaps the visible ends of a reversed range once focus leaves the range, without another report', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <>
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          startName="from"
          endName="to"
          onValueChange={onValueChange}
        />
        <button type="button">Next</button>
      </>,
    );
    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('2026101720261005');
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toEqual({ start: '2026-10-05', end: '2026-10-17' });

    await screen.getByRole('button', { name: 'Next' }).click();

    await expect.element(screen.getByRole('group', { name: ko.labels.rangeStart })).toHaveTextContent('2026. 10. 05');
    await expect.element(screen.getByRole('group', { name: ko.labels.rangeEnd })).toHaveTextContent('2026. 10. 17');
    const hiddenValues = ['from', 'to'].map(
      (name) => (screen.container.querySelector(`input[name="${name}"]`) as HTMLInputElement).value, // as: name으로 고른 요소는 HiddenInput이 그린 input임
    );
    expect(hiddenValues).toEqual(['2026-10-05', '2026-10-17']);
    await settleEffects();
    expect(onValueChange).toHaveBeenCalledTimes(1);
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

  it('does not emit a start date alone when an open end is not allowed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20261013');

    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).last()).toHaveFocus();
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
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
    await expect.element(screen.getByRole('group', { name: ko.labels.rangeStart })).toHaveAttribute('data-invalid', '');
    await expect
      .element(screen.getByRole('spinbutton', { name: ko.labels.day }).first())
      .toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(screen.getByRole('spinbutton', { name: ko.labels.day }).last())
      .toHaveAttribute('aria-invalid', 'true');
  });

  it('marks only the end whose own date is invalid', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20260230');
    await screen.getByRole('spinbutton', { name: ko.labels.year }).last().click();
    await userEvent.keyboard('20261017');

    await expect.element(screen.getByRole('group', { name: '기간' })).toHaveAttribute('data-invalid', '');
    await expect
      .element(screen.getByRole('spinbutton', { name: ko.labels.day }).first())
      .toHaveAttribute('aria-invalid', 'true');
    await expect
      .element(screen.getByRole('spinbutton', { name: ko.labels.day }).last())
      .not.toHaveAttribute('aria-invalid');
    await expect.element(screen.getByRole('group', { name: ko.labels.rangeEnd })).not.toHaveAttribute('data-invalid');
  });

  it('stays invalid while the other end is still being typed', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await screen.getByRole('spinbutton', { name: ko.labels.year }).first().click();
    await userEvent.keyboard('20260230');
    await screen.getByRole('spinbutton', { name: ko.labels.year }).last().click();
    await userEvent.keyboard('2');

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
      const formData = new FormData(screen.getByRole('form').element() as HTMLFormElement); // as: form 역할 요소임

      expect([formData.get('from'), formData.get('to')]).toEqual(['2026-10-13', '2026-10-17']);
    });

    it.each([
      ['requires the end', false, true],
      ['leaves the end optional', true, false],
    ])('%s when isOpenEndAllowed is %s', async (_, isOpenEndAllowed, isEndRequired) => {
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          required
          isOpenEndAllowed={isOpenEndAllowed}
          startName="from"
          endName="to"
        />,
      );
      const endYear = screen.getByRole('spinbutton', { name: ko.labels.year }).last();

      expect(screen.container.querySelector('input[name="from"]')?.hasAttribute('required')).toBe(true);
      expect(screen.container.querySelector('input[name="to"]')?.hasAttribute('required')).toBe(isEndRequired);
      expect(endYear.element().getAttribute('aria-required')).toBe(isEndRequired ? 'true' : null);
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

    it('keeps a controlled half range without an open end silent on mount', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          value={{ start: '2026-10-13', end: null }}
          onValueChange={onValueChange}
        />,
      );

      await expect.element(screen.getByRole('group', { name: ko.labels.rangeStart })).toHaveTextContent('2026. 10. 13');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('starts the empty end of an open-ended lunar value in the lunar calendar', async () => {
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          calendars={[dangi]}
          isOpenEndAllowed
          defaultValue={{ start: '1990-06-23[u-ca=dangi]', end: null }}
        />,
      );

      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeEnd }))
        .toHaveAttribute('data-calendar', 'dangi');
    });

    it('switches both ends when the user picks another calendar and reports it once', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <DateRangeField.Root
          aria-label="기간"
          locale={ko}
          calendars={[dangi]}
          defaultValue={GREGORY_RANGE}
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        >
          <DateRangeField.Start />
          <DateRangeField.Separator />
          <DateRangeField.End />
          <LunarEntryButton />
        </DateRangeField.Root>,
      );

      await screen.getByRole('button', { name: 'Lunar entry' }).click();

      await expect
        .poll(() => onValueChange.mock.calls.at(-1)?.[0])
        .toEqual({ start: '2026-10-13[u-ca=dangi]', end: '2026-10-17[u-ca=dangi]' });
      await expect
        .element(screen.getByRole('group', { name: ko.labels.rangeEnd }))
        .toHaveAttribute('data-calendar', 'dangi');
      expect(onEntryCalendarChange.mock.calls).toEqual([['dangi']]);
    });

    it('keeps the start when the parent echoes the null emitted for an erased end', async () => {
      const onValueChange = vi.fn();
      const EchoingParent = () => {
        const [value, setValue] = useState<DateRangeInput | null>(GREGORY_RANGE);
        return (
          <>
            <DateRangeField.Root
              aria-label="기간"
              locale={ko}
              value={value}
              onValueChange={(next, details) => {
                onValueChange(next, details);
                setValue(next);
              }}
            />
            <button type="button" onClick={() => setValue({ start: '2026-11-01', end: '2026-11-05' })}>
              Next month
            </button>
          </>
        );
      };
      const screen = await render(<EchoingParent />);

      await screen.getByRole('spinbutton', { name: ko.labels.day }).last().click();
      await userEvent.keyboard('{Backspace}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
      await settleEffects();
      await expect.element(screen.getByRole('group', { name: ko.labels.rangeStart })).toHaveTextContent('2026. 10. 13');

      await screen.getByRole('button', { name: 'Next month' }).click();

      await expect.element(screen.getByRole('group', { name: ko.labels.rangeStart })).toHaveTextContent('2026. 11. 01');
      await expect.element(screen.getByRole('group', { name: ko.labels.rangeEnd })).toHaveTextContent('2026. 11. 05');
    });

    it('clears the start when the parent resets a mounted half range to null', async () => {
      const screen = await render(<ResettingParent initialValue={{ start: '2026-10-13', end: null }} />);
      const startGroup = screen.getByRole('group', { name: ko.labels.rangeStart });
      await expect.element(startGroup).toHaveTextContent('2026. 10. 13');

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.element(startGroup).toHaveTextContent('YYYY. MM. DD');
    });

    it('clears the start when the parent resets a pushed half range to null', async () => {
      const screen = await render(
        <ResettingParent initialValue={GREGORY_RANGE} pushedValue={{ start: '2026-11-01', end: null }} />,
      );
      const startGroup = screen.getByRole('group', { name: ko.labels.rangeStart });
      await screen.getByRole('button', { name: 'Push' }).click();
      await expect.element(startGroup).toHaveTextContent('2026. 11. 01');

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.element(startGroup).toHaveTextContent('YYYY. MM. DD');
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

  it('hydrates server-rendered markup without recoverable errors', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(
      <DateRangeField.Root aria-label="기간" locale={ko} today="2026-10-14" defaultValue={GREGORY_RANGE} />,
    );

    expect(recoverableErrors).toEqual([]);
    unmount();
  });

  it('has no accessibility violations', async () => {
    const screen = await render(<DateRangeField.Root aria-label="기간" locale={ko} />);

    await expectNoAxeViolations(screen.container);
  });
});
