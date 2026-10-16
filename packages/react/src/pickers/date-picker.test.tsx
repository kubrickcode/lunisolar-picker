import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusOnce } from '../testing/focus-once';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { DatePicker } from './index';

const FIELD_NAME = 'installedOn';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

const inputsNamed = (name: string): HTMLInputElement[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

describe('DatePicker', () => {
  describe('immediate mode', () => {
    it('opens the calendar from the trigger, selects a day and closes', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<DatePicker presentation="popover" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();

      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('20');
    });

    it('closes when the selected day is picked again without reporting a change', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DatePicker presentation="popover" defaultValue="2026-10-20" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('confirm mode', () => {
    it('waits for the confirm button', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          commitMode="confirm"
          defaultValue="2026-10-01"
          onValueChange={onValueChange}
        />,
      );

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: ko.labels.confirm }).click();
      expect(onValueChange).toHaveBeenCalledWith('2026-10-20', VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('drops an unconfirmed pick when cancelled and shows the committed day on reopening', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          commitMode="confirm"
          defaultValue="2026-10-01"
          onValueChange={onValueChange}
        />,
      );
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDate });

      await trigger.click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();
      await screen.getByRole('button', { name: ko.labels.cancel }).click();
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await trigger.click();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-01') }))
        .toHaveAttribute('aria-selected', 'true');
      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'false');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('disables confirm until a day is picked', async () => {
      const screen = await renderPicker(<DatePicker presentation="popover" commitMode="confirm" />);

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();

      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeEnabled();
    });

    it('labels the footer in the locale given to the picker', async () => {
      const screen = await renderPicker(<DatePicker presentation="popover" commitMode="confirm" locale={en} />);

      await screen.getByRole('button', { name: en.labels.chooseDate }).click();

      await expect.element(screen.getByRole('button', { name: en.labels.confirm })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: en.labels.cancel })).toBeVisible();
    });
  });

  describe('opening focus', () => {
    it('focuses the selected day', async () => {
      const screen = await renderPicker(<DatePicker presentation="popover" defaultValue="2026-10-20" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDate });
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-20') })).toHaveFocus();
    });

    it('focuses today when nothing is selected', async () => {
      const screen = await renderPicker(<DatePicker presentation="popover" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDate });
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('button', { name: dayLabel(FIXED_TODAY) })).toHaveFocus();
    });
  });

  describe('trigger', () => {
    it('renders an app trigger with the formatted value', async () => {
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          defaultValue="2026-10-20"
          separator="-"
          renderTrigger={({ displayValue, triggerProps }) => (
            <button {...triggerProps} type="button">
              {`설치일 ${displayValue}`}
            </button>
          )}
        />,
      );

      await expect.element(screen.getByRole('button', { name: '설치일 2026-10-20' })).toBeVisible();
    });

    it('opens an app trigger as a popover anchored to it', async () => {
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          placeholder="설치일"
          renderTrigger={({ displayValue, isOpen, placeholder, triggerProps }) => (
            <button {...triggerProps} type="button" data-testid="chip">
              {`${displayValue || placeholder}${isOpen ? ' (열림)' : ''}`}
            </button>
          )}
        />,
      );

      await screen.getByRole('button', { name: '설치일' }).click();

      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await expect.element(screen.getByTestId('chip')).toHaveTextContent('설치일 (열림)');
      await expect.element(screen.getByTestId('chip')).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens as a sheet when asked', async () => {
      const screen = await renderPicker(<DatePicker presentation="sheet" />);

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();

      await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      await userEvent.keyboard('{Escape}');
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', { disabled: true }],
      ['read-only', { readOnly: true }],
    ])('cannot be opened while %s', async (_, stateProps) => {
      const screen = await renderPicker(<DatePicker presentation="popover" {...stateProps} />);

      await expect.element(screen.getByRole('button', { name: ko.labels.chooseDate })).toBeDisabled();
    });
  });

  describe('form', () => {
    it('submits the value through the field alone while the calendar is open', async () => {
      const screen = await renderPicker(
        <form>
          <DatePicker presentation="popover" name={FIELD_NAME} defaultValue="2026-10-20" />
        </form>,
      );

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      expect(inputsNamed(FIELD_NAME).map((input) => input.value)).toEqual(['2026-10-20']);
    });

    it('focuses the first segment through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<DatePicker presentation="popover" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toHaveFocus();
    });
  });

  it('has no axe violations while open', async () => {
    const screen = await render(
      <DatePicker presentation="popover" locale={en} today={FIXED_TODAY} defaultValue="2026-10-20" />,
    );

    await screen.getByRole('button', { name: en.labels.chooseDate }).click();
    await expect.element(screen.getByRole('grid')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
