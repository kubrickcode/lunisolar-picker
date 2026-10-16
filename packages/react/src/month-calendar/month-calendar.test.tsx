import { toMonthCode } from '@lunisolar-picker/calendar';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { formElementOf } from '../testing/form-element';
import { KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { MonthCalendar } from './index';

const TAB_STOP_SELECTOR = '[data-lsp-part="calendar-month-grid"] button[tabindex="0"]';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const monthName = (month: number): string =>
  ko.formatMonthName({ year: 2026, monthCode: toMonthCode(month, false) }, 'gregory');

const renderMonthCalendar = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

const hiddenInputOf = (container: HTMLElement, name: string): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`hidden input ${name} is missing`);
  return input;
};

const tabStopName = (container: HTMLElement): string | null =>
  container.querySelector(TAB_STOP_SELECTOR)?.getAttribute('aria-label') ?? null;

describe('MonthCalendar', () => {
  describe('picking', () => {
    it('emits the picked month as a canonical month string', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <MonthCalendar.Root defaultValue="2026-10" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: monthName(11) }).click();

      expect(onValueChange).toHaveBeenCalledWith('2026-11', VALID_DETAILS);
      await expect
        .element(screen.getByRole('gridcell', { name: monthName(11) }))
        .toHaveAttribute('aria-selected', 'true');
    });

    it('stays silent when the selected month is picked again', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <MonthCalendar.Root defaultValue="2026-10" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: monthName(10) }).click();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('disables months outside min and max', async () => {
      const screen = await renderMonthCalendar(
        <MonthCalendar.Root defaultValue="2026-10" min="2026-03" max="2026-10" />,
      );

      await expect.element(screen.getByRole('button', { name: monthName(2) })).toHaveAttribute('aria-disabled', 'true');
      await expect
        .element(screen.getByRole('button', { name: monthName(11) }))
        .toHaveAttribute('aria-disabled', 'true');
      await expect.element(screen.getByRole('button', { name: monthName(3) })).not.toHaveAttribute('aria-disabled');
    });

    it('has no axe violations', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root defaultValue="2026-10" min="2026-03" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      await expectNoAxeViolations(screen.container);
    });
  });

  describe('years', () => {
    it('moves between years', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root defaultValue="2026-10" />);

      await screen.getByRole('button', { name: ko.labels.nextYear }).click();
      await expect.element(screen.getByText('2027')).toBeVisible();
      await screen.getByRole('button', { name: ko.labels.previousYear }).click();
      await screen.getByRole('button', { name: ko.labels.previousYear }).click();

      await expect.element(screen.getByText('2025')).toBeVisible();
    });

    it('stops at the last year a month string can hold', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root defaultValue="9999-05" />);
      const nextButton = screen.getByRole('button', { name: ko.labels.nextYear });
      await expect.element(nextButton).toHaveAttribute('aria-disabled', 'true');

      await nextButton.click({ force: true });
      await settleEffects();

      await expect.element(screen.getByText('9999')).toBeVisible();
      await expect
        .element(screen.getByRole('button', { name: ko.labels.previousYear }))
        .not.toHaveAttribute('aria-disabled');
    });

    it('opens on the year of today with this month as the tab stop when there is no value', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root />);
      await expect.element(screen.getByText('2026')).toBeVisible();

      expect(tabStopName(screen.container)).toBe(monthName(10));
    });

    it('opens on the year of a controlled empty value, ignoring defaultValue', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root value={null} defaultValue="2030-05" />);
      await expect.element(screen.getByText('2026')).toBeVisible();

      expect(screen.container.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
    });
  });

  describe('controlled', () => {
    it('returns to the parent value when the parent keeps it unchanged', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(<MonthCalendar.Root value="2026-10" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: monthName(11) }).click();
      await settleEffects();

      expect(onValueChange).toHaveBeenCalledWith('2026-11', VALID_DETAILS);
      await expect
        .element(screen.getByRole('gridcell', { name: monthName(10) }))
        .toHaveAttribute('aria-selected', 'true');
      await expect
        .element(screen.getByRole('gridcell', { name: monthName(11) }))
        .toHaveAttribute('aria-selected', 'false');
    });

    it('reports a non-canonical value and treats it as empty', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderMonthCalendar(<MonthCalendar.Root value="2026-1" onInvalidValue={onInvalidValue} />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      await expect.poll(() => onInvalidValue.mock.calls).toEqual([['2026-1', 'invalid-date']]);
      expect(screen.container.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
    });

    it('looks invalid when the parent value breaks a constraint', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root value="2026-11" max="2026-10" />);

      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(screen.container.querySelector('[data-lsp-part="month-calendar"]')?.hasAttribute('data-invalid')).toBe(
        true,
      );
    });
  });

  describe('disabled', () => {
    it('leaves no tab stop and ignores years and picks', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <MonthCalendar.Root disabled defaultValue="2026-10" onValueChange={onValueChange} />,
      );
      const nextButton = screen.getByRole('button', { name: ko.labels.nextYear });
      await expect.element(nextButton).toHaveAttribute('aria-disabled', 'true');
      expect(screen.container.querySelectorAll(TAB_STOP_SELECTOR)).toHaveLength(0);

      await nextButton.click({ force: true });
      await screen.getByRole('button', { name: monthName(11) }).click({ force: true });
      await settleEffects();

      await expect.element(screen.getByText('2026')).toBeVisible();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('read-only', () => {
    it('moves between years but keeps the selection', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <MonthCalendar.Root readOnly defaultValue="2026-10" onValueChange={onValueChange} />,
      );
      await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');

      await screen.getByRole('button', { name: monthName(11) }).click();
      await settleEffects();
      await expect
        .element(screen.getByRole('gridcell', { name: monthName(10) }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: ko.labels.nextYear }).click();
      await expect.element(screen.getByText('2027')).toBeVisible();
    });
  });

  it('reports blur once when focus leaves the month calendar, not while moving inside it', async () => {
    const onBlur = vi.fn();
    const screen = await render(
      <KoreanProvider>
        <MonthCalendar.Root defaultValue="2026-10" onBlur={onBlur} />
        <input aria-label="outside" />
      </KoreanProvider>,
    );
    await clickToFocus(screen.getByRole('button', { name: monthName(10) }));

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(screen.getByRole('button', { name: monthName(11) })).toHaveFocus();
    await settleEffects();
    expect(onBlur).not.toHaveBeenCalled();

    await clickToFocus(screen.getByRole('textbox', { name: 'outside' }));

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  describe('form participation', () => {
    it('submits the value and blocks submission while required and empty', async () => {
      const screen = await renderMonthCalendar(
        <form aria-label="report">
          <MonthCalendar.Root name="reportMonth" defaultValue="2026-10" />
          <MonthCalendar.Root name="closingMonth" required />
        </form>,
      );
      await expect.element(screen.getByRole('grid').first()).toBeVisible();

      expect(hiddenInputOf(screen.container, 'reportMonth').value).toBe('2026-10');
      expect(hiddenInputOf(screen.container, 'closingMonth').checkValidity()).toBe(false);
      expect(screen.container.querySelectorAll('[data-lsp-part="month-calendar"][data-invalid]')).toHaveLength(0);
    });

    it('moves focus from the hidden input to the tab stop month', async () => {
      const screen = await renderMonthCalendar(<MonthCalendar.Root name="reportMonth" defaultValue="2026-04" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      hiddenInputOf(screen.container, 'reportMonth').focus();

      await expect.element(screen.getByRole('button', { name: monthName(4) })).toHaveFocus();
    });

    it('returns an uncontrolled month calendar to its default value on form reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <form aria-label="report">
          <MonthCalendar.Root name="reportMonth" defaultValue="2026-10" onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: monthName(12) }).click();
      await expect.poll(() => hiddenInputOf(screen.container, 'reportMonth').value).toBe('2026-12');

      formElementOf(screen.getByRole('form')).reset();

      await expect.poll(() => hiddenInputOf(screen.container, 'reportMonth').value).toBe('2026-10');
      expect(onValueChange.mock.calls).toEqual([
        ['2026-12', VALID_DETAILS],
        ['2026-10', VALID_DETAILS],
      ]);
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderMonthCalendar(
        <form aria-label="report">
          <MonthCalendar.Root name="reportMonth" value="2026-12" defaultValue="2026-10" onValueChange={onValueChange} />
        </form>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      formElementOf(screen.getByRole('form')).reset();
      await settleEffects();

      expect(hiddenInputOf(screen.container, 'reportMonth').value).toBe('2026-12');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
