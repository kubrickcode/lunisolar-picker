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
import { DateFieldContext } from './date-field-context';
import * as DateField from './parts';
import { type UseDateFieldProps, useDateField } from './use-date-field';

const CalendarSwitchingField = (props: UseDateFieldProps) => {
  const field = useDateField(props);
  return (
    <DateFieldContext value={field}>
      <div role="group" aria-label="Date" {...field.getRootProps()}>
        {field.state.segments.map((segment, index) => (
          <DateField.Segment key={segment.kind} index={index} />
        ))}
      </div>
      <button type="button" onClick={() => field.setEntryCalendar('dangi')}>
        Lunar entry
      </button>
    </DateFieldContext>
  );
};

const dispatchPaste = (element: Element, text: string): void => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  element.dispatchEvent(event);
};

describe('DateField', () => {
  it('fills a Korean date from eight typed digits and reports it once complete', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="생년월일" locale={ko} name="birthDate" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('20261014');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-14');
    // as: name으로 고른 요소는 HiddenInput이 그린 input임
    expect((screen.container.querySelector('input[name="birthDate"]') as HTMLInputElement).value).toBe('2026-10-14');
  });

  it('follows the English month-day-year order', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton').first().click();
    await userEvent.keyboard('10142026');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-14');
  });

  it('shows the separator given by the app', async () => {
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} separator="-" defaultValue="2026-10-14" />,
    );

    await expect.element(screen.getByRole('group')).toHaveTextContent('2026-10-14');
  });

  it('steps the focused segment with the arrow keys', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} defaultValue="2026-10-14" onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.day }).click();
    await userEvent.keyboard('{ArrowUp}');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-15');
  });

  it('reads a pasted date with any punctuation', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} onValueChange={onValueChange} />);
    const year = screen.getByRole('spinbutton', { name: ko.labels.year });
    await year.click();

    dispatchPaste(year.element(), '1990.3.15');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-03-15');
  });

  it('keeps aria-valuenow within the segment bounds when a paste overflows them', async () => {
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} />);
    const year = screen.getByRole('spinbutton', { name: ko.labels.year });
    await year.click();

    dispatchPaste(year.element(), '1990.13.40');

    const month = screen.getByRole('spinbutton', { name: ko.labels.month });
    await expect.element(month).toHaveAttribute('aria-valuenow', '12');
    await expect.element(month).toHaveAttribute('aria-valuetext', '13');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid', '');
  });

  it('enters a lunar leap-month date and emits it with the calendar annotation', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root
        aria-label="Date"
        locale={ko}
        calendars={[dangi]}
        defaultEntryCalendar="dangi"
        onValueChange={onValueChange}
      />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('199005');
    await userEvent.keyboard('L');
    await userEvent.keyboard('01');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-06-23[u-ca=dangi]');
  });

  it('lets the leap month be turned off after the month changes to one without a leap month', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root
        aria-label="Date"
        locale={ko}
        calendars={[dangi]}
        defaultEntryCalendar="dangi"
        defaultValue="1990-06-23[u-ca=dangi]"
        onValueChange={onValueChange}
      />,
    );
    await screen.getByRole('spinbutton', { name: ko.labels.month }).click();
    await userEvent.keyboard('06');
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('invalid-date');

    const toggle = screen.getByRole('button', { name: ko.labels.leapMonth });
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-07-22[u-ca=dangi]');
  });

  it('keeps a typed lunar day 30 in a 29-day month as an invalid entry instead of changing it', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root
        aria-label="Date"
        locale={ko}
        calendars={[dangi]}
        defaultEntryCalendar="dangi"
        onValueChange={onValueChange}
      />,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('20251229');
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).not.toBeNull();
    await userEvent.keyboard('{Backspace}{Backspace}30');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[1]?.validity.reasons).toContain('invalid-date');
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('30');
  });

  it('restores segment text and applies digits after uncancelable composition input', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} defaultValue="2026-10-14" onValueChange={onValueChange} />,
    );
    const day = screen.getByRole('spinbutton', { name: ko.labels.day });
    await day.click();
    const dayElement = day.element();

    dayElement.textContent = '14garbage';
    dayElement.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: '0', bubbles: true }));
    dayElement.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: '9', bubbles: true }));

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('2026-10-09');
    await expect.element(day).toHaveTextContent('09');
  });

  it('syncs a controlled value without reporting it back', async () => {
    const onValueChange = vi.fn();
    const Controlled = () => {
      const [value, setValue] = useState('2026-10-14');
      return (
        <>
          <DateField.Root aria-label="Date" locale={ko} value={value} onValueChange={onValueChange} />
          <button type="button" onClick={() => setValue('2027-01-02')}>
            Next year
          </button>
        </>
      );
    };
    const screen = await render(<Controlled />);

    await screen.getByRole('button', { name: 'Next year' }).click();

    await expect.element(screen.getByRole('group')).toMatchTextContent('2027');
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('switches to the calendar of a controlled value in another calendar without reporting it back', async () => {
    const onValueChange = vi.fn();
    const onEntryCalendarChange = vi.fn();
    const Controlled = () => {
      const [value, setValue] = useState('2026-10-14');
      return (
        <>
          <DateField.Root
            aria-label="Date"
            locale={ko}
            calendars={[dangi]}
            value={value}
            onValueChange={onValueChange}
            onEntryCalendarChange={onEntryCalendarChange}
          />
          <button type="button" onClick={() => setValue('1990-06-23[u-ca=dangi]')}>
            Lunar date
          </button>
        </>
      );
    };
    const screen = await render(<Controlled />);

    await screen.getByRole('button', { name: 'Lunar date' }).click();

    await expect.element(screen.getByRole('group')).toMatchTextContent('1990. 윤05. 01');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-calendar', 'dangi');
    await settleEffects();
    expect(onEntryCalendarChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps the value and reorders segments when the locale changes', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} defaultValue="2026-10-14" onValueChange={onValueChange} />,
    );

    await screen.rerender(
      <DateField.Root aria-label="Date" locale={en} defaultValue="2026-10-14" onValueChange={onValueChange} />,
    );

    await expect.element(screen.getByRole('group')).toHaveTextContent('10/14/2026');
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  describe('entry calendar', () => {
    it('keeps the calendar of a controlled value over defaultEntryCalendar on mount without callbacks', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <DateField.Root
          aria-label="Date"
          locale={ko}
          calendars={[dangi]}
          value="2026-10-14"
          defaultEntryCalendar="dangi"
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        />,
      );

      await expect.element(screen.getByRole('group')).toHaveTextContent('2026. 10. 14');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onEntryCalendarChange).not.toHaveBeenCalled();
    });

    it('keeps the calendar of a controlled value over a controlled entryCalendar on mount without callbacks', async () => {
      const onValueChange = vi.fn();
      const onEntryCalendarChange = vi.fn();
      const screen = await render(
        <DateField.Root
          aria-label="Date"
          locale={ko}
          calendars={[dangi]}
          value="2026-10-14"
          entryCalendar="dangi"
          onValueChange={onValueChange}
          onEntryCalendarChange={onEntryCalendarChange}
        />,
      );

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-calendar', 'gregory');
      await expect.element(screen.getByRole('group')).toHaveTextContent('2026. 10. 14');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onEntryCalendarChange).not.toHaveBeenCalled();
    });

    it('enters in defaultEntryCalendar when there is no value', async () => {
      const screen = await render(
        <DateField.Root aria-label="Date" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" />,
      );

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-calendar', 'dangi');
      await expect.element(screen.getByRole('button', { name: ko.labels.leapMonth })).toBeInTheDocument();
    });

    it('applies a user calendar switch even when the parent keeps a controlled entryCalendar', async () => {
      const onEntryCalendarChange = vi.fn();
      const onValueChange = vi.fn();
      const screen = await render(
        <CalendarSwitchingField
          locale={ko}
          calendars={[dangi]}
          defaultValue="1990-06-23"
          entryCalendar="gregory"
          onEntryCalendarChange={onEntryCalendarChange}
          onValueChange={onValueChange}
        />,
      );

      await screen.getByRole('button', { name: 'Lunar entry' }).click();

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-calendar', 'dangi');
      expect(onEntryCalendarChange).toHaveBeenCalledWith('dangi');
      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-06-23[u-ca=dangi]');
    });
  });

  it('toggles the leap month from the L key position while a Korean IME is active', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root
        aria-label="Date"
        locale={ko}
        calendars={[dangi]}
        defaultEntryCalendar="dangi"
        onValueChange={onValueChange}
      />,
    );
    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('199005');

    screen
      .getByRole('spinbutton', { name: ko.labels.day })
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ㅣ', code: 'KeyL', bubbles: true, cancelable: true }));
    await userEvent.keyboard('01');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('1990-06-23[u-ca=dangi]');
  });

  it('moves between segments but keeps the value while read-only', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root aria-label="Date" locale={ko} readOnly defaultValue="2026-10-14" onValueChange={onValueChange} />,
    );
    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();

    await userEvent.keyboard('{ArrowRight}{ArrowUp}');

    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.month })).toHaveFocus();
    await expect.element(screen.getByRole('group')).toHaveTextContent('2026. 10. 14');
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it.each([
    ['disabled', { disabled: true }],
    ['read-only', { readOnly: true }],
  ])('ignores a paste while %s', async (_, flags) => {
    const onValueChange = vi.fn();
    const screen = await render(
      <DateField.Root
        aria-label="Date"
        locale={ko}
        defaultValue="2026-10-14"
        onValueChange={onValueChange}
        {...flags}
      />,
    );

    dispatchPaste(screen.getByRole('spinbutton', { name: ko.labels.year }).element(), '1990.3.15');

    await settleEffects();
    await expect.element(screen.getByRole('group')).toHaveTextContent('2026. 10. 14');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not take focus from a click while disabled', async () => {
    const screen = await render(<DateField.Root aria-label="Date" locale={ko} disabled defaultValue="2026-10-14" />);
    const year = screen.getByRole('spinbutton', { name: ko.labels.year });

    await userEvent.click(year, { force: true });

    await settleEffects();
    await expect.element(year).not.toHaveFocus();
    await expect.element(year).not.toHaveAttribute('data-focused');
  });

  it('cannot be edited or focused while disabled', async () => {
    const screen = await render(<DateField.Root aria-label="Date" disabled defaultValue="2026-10-14" />);
    const segment = screen.getByRole('spinbutton').first();

    await expect.element(segment).toHaveAttribute('contenteditable', 'false');
    await expect.element(segment).toHaveAttribute('tabindex', '-1');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-disabled', '');
  });

  it('has no accessibility violations', async () => {
    const screen = await render(
      <DateField.Root aria-label="생년월일" locale={ko} calendars={[dangi]} defaultEntryCalendar="dangi" />,
    );

    await expectNoAxeViolations(screen.container);
  });

  it('reports onBlur once when focus leaves the whole field, not between segments', async () => {
    const onBlur = vi.fn();
    const screen = await render(
      <>
        <DateField.Root aria-label="Date" locale={ko} onBlur={onBlur} />
        <button type="button">Next field</button>
      </>,
    );

    await screen.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('{Tab}');
    expect(onBlur).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: 'Next field' }).click();

    await expect.poll(() => onBlur.mock.calls.length).toBe(1);
  });

  it('hydrates without a mismatch', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(
      <DateField.Root aria-label="Date" locale={ko} today="2026-10-14" defaultValue="2026-10-14" />,
    );

    expect(recoverableErrors).toEqual([]);
    unmount();
  });
});
