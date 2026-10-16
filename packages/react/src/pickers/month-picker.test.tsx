import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { endsWith, hiddenInputNamed, inputsNamed, renderChipTrigger } from '../testing/picker-fixture';
import { settleEffects } from '../testing/settle-effects';
import { MonthPicker } from './index';

const CHIP_PLACEHOLDER = '정산월';
const FIELD_NAME = 'settledIn';
const FORM_LABEL = '정산 정보';
const NOVEMBER_HEADING = ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory');
const NOVEMBER_NAME = ko.formatMonthName({ year: 2026, monthCode: 'M11' }, 'gregory');
const OCTOBER_NAME = ko.formatMonthName({ year: 2026, monthCode: 'M10' }, 'gregory');
const OUTSIDE_BUTTON_LABEL = '바깥';
// Goal: 트리거 이름은 "보이는 값 + 동작 라벨"이므로 값이 있든 없든 동작 라벨로 끝나는지로 찾음
const TRIGGER_NAME = endsWith(ko.labels.chooseMonth);
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

describe('MonthPicker', () => {
  describe('picking', () => {
    it('picks a month and shows it in the trigger', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <MonthPicker presentation="popover" defaultValue="2026-10" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await screen.getByRole('button', { name: NOVEMBER_NAME }).click();

      expect(onValueChange).toHaveBeenCalledWith('2026-11', VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent(NOVEMBER_HEADING);
    });

    it('closes when the selected month is picked again without reporting a change', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker(
        <MonthPicker presentation="popover" defaultValue="2026-10" onValueChange={onValueChange} onPick={onPick} />,
      );

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await screen.getByRole('button', { name: OCTOBER_NAME }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onPick).toHaveBeenCalledWith('2026-10');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('focuses the selected month on opening', async () => {
      const screen = await renderPicker(<MonthPicker presentation="popover" defaultValue="2026-11" />);
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('button', { name: NOVEMBER_NAME })).toHaveFocus();
    });

    it('names the trigger by the shown month followed by its action', async () => {
      const screen = await renderPicker(<MonthPicker presentation="popover" defaultValue="2026-11" />);

      await expect
        .element(screen.getByRole('button', { name: `${NOVEMBER_HEADING} ${ko.labels.chooseMonth}`, exact: true }))
        .toBeVisible();
    });

    it('shows the placeholder until a month is picked', async () => {
      const screen = await renderPicker(<MonthPicker presentation="popover" placeholder={CHIP_PLACEHOLDER} />);

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent(CHIP_PLACEHOLDER);
      expect(screen.container.querySelector('[data-lsp-part="month-picker"]')?.hasAttribute('data-placeholder')).toBe(
        true,
      );
    });

    it('marks the picker invalid when the value breaks a limit', async () => {
      const screen = await renderPicker(
        <>
          <MonthPicker presentation="popover" defaultValue="2026-12" max="2026-11" />
          <MonthPicker presentation="popover" defaultValue="2026-10" max="2026-11" />
        </>,
      );
      const [outOfRange, withinRange] = Array.from(
        screen.container.querySelectorAll<HTMLElement>('[data-lsp-part="month-picker"]'),
      );

      expect(outOfRange?.hasAttribute('data-invalid')).toBe(true);
      expect(withinRange?.hasAttribute('data-invalid')).toBe(false);
    });
  });

  describe('presentation', () => {
    it('closes the sheet from its close button and returns focus to the trigger', async () => {
      const screen = await renderPicker(<MonthPicker presentation="sheet" />);
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
      await focusOnce(trigger);

      await trigger.click();
      await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      await screen.getByRole('button', { name: ko.labels.close }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
    });

    it.each(['popover', 'sheet'] as const)(
      'stays closed in the %s and reports closing when asked to open while read-only',
      async (presentation) => {
        const onOpenChange = vi.fn();
        const screen = await renderPicker(
          <MonthPicker presentation={presentation} readOnly open onOpenChange={onOpenChange} />,
        );

        await expect.poll(() => onOpenChange.mock.calls).toEqual([[false]]);
        await expect
          .element(screen.getByRole('button', { name: TRIGGER_NAME }))
          .toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelector('[role="dialog"]')).toBeNull();
      },
    );

    it('cannot be opened or focused while disabled', async () => {
      const screen = await renderPicker(<MonthPicker presentation="popover" disabled />);

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toBeDisabled();
    });

    it('keeps the read-only trigger focusable for the ref and form validation without opening it', async () => {
      const ref = createRef<{ focus(): void }>();
      const onOpenChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker
            presentation="popover"
            name={FIELD_NAME}
            readOnly
            defaultValue="2026-10"
            ref={ref}
            onOpenChange={onOpenChange}
          />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
      await expect.element(trigger).toHaveAttribute('aria-disabled', 'true');
      await expect.element(trigger).not.toHaveAttribute('disabled');

      ref.current?.focus();
      await expect.element(trigger).toHaveFocus();
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));
      hiddenInputNamed(FIELD_NAME).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await expect.element(trigger).toHaveFocus();
      await trigger.click({ force: true });
      await settleEffects();

      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('trigger', () => {
    it('forwards the labels and id to the trigger and names the dialog after them', async () => {
      const screen = await renderPicker(
        <MonthPicker
          presentation="popover"
          id="settled-in"
          aria-label="정산월 고르기"
          aria-describedby="settled-hint"
        />,
      );
      const trigger = screen.getByRole('button', { name: '정산월 고르기' });

      await expect.element(trigger).toHaveAttribute('id', 'settled-in');
      await expect.element(trigger).toHaveAttribute('aria-describedby', 'settled-hint');
      await trigger.click();
      await expect.element(screen.getByRole('dialog', { name: '정산월 고르기' })).toBeVisible();
    });

    it('names the trigger after a visible label it is pointed at', async () => {
      const screen = await renderPicker(
        <>
          <span id="settled-label">{CHIP_PLACEHOLDER}</span>
          <MonthPicker presentation="popover" aria-labelledby="settled-label" />
        </>,
      );

      await expect.element(screen.getByRole('button', { name: CHIP_PLACEHOLDER })).toBeVisible();
    });

    it('puts the shown month before a visible label it is pointed at', async () => {
      const screen = await renderPicker(
        <>
          <span id="settled-label">{CHIP_PLACEHOLDER}</span>
          <MonthPicker presentation="popover" aria-labelledby="settled-label" defaultValue="2026-11" />
        </>,
      );

      await expect
        .element(screen.getByRole('button', { name: `${NOVEMBER_HEADING} ${CHIP_PLACEHOLDER}`, exact: true }))
        .toBeVisible();
    });

    it('renders an app trigger with the formatted value', async () => {
      const screen = await renderPicker(
        <MonthPicker presentation="popover" defaultValue="2026-11" renderTrigger={renderChipTrigger} />,
      );

      await expect.element(screen.getByTestId('chip')).toHaveTextContent(NOVEMBER_HEADING);
    });

    it('focuses the trigger through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<MonthPicker presentation="popover" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
    });

    it('reports leaving the closed trigger but not moving into the popover', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <MonthPicker presentation="popover" defaultValue="2026-10" onBlur={onBlur} />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
      await focusOnce(trigger);

      await trigger.click();
      await expect.element(screen.getByRole('button', { name: OCTOBER_NAME })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      await expect.element(trigger).toHaveFocus();
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();

      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));
      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });

    it('reports an unreadable value once, not again when the calendar opens', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <MonthPicker presentation="popover" value="2026-13" onInvalidValue={onInvalidValue} />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['2026-13', 'invalid-date']]);
    });

    it('parses an unreadable default value silently', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <MonthPicker presentation="popover" defaultValue="2026-13" onInvalidValue={onInvalidValue} />,
      );
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toBeVisible();
      await settleEffects();

      expect(onInvalidValue).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it.each([
      ['with a value', { defaultValue: '2026-10' }, true],
      ['while empty', {}, false],
      ['while disabled', { defaultValue: '2026-10', disabled: true }, false],
      ['while read-only', { defaultValue: '2026-10', readOnly: true }, false],
      ['when turned off', { defaultValue: '2026-10', isClearable: false }, false],
    ] as const)('shows the clear button %s', async (_, stateProps, isShown) => {
      const screen = await renderPicker(<MonthPicker presentation="popover" {...stateProps} />);
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toBeInTheDocument();

      const clear = screen.getByRole('button', { name: ko.labels.clear });
      if (isShown) await expect.element(clear).toBeVisible();
      else await expect.element(clear).not.toBeInTheDocument();
    });

    it('empties the value once, returns focus to the trigger and leaves a required form invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker
            presentation="popover"
            name={FIELD_NAME}
            required
            defaultValue="2026-10"
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(true);

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
      await expect
        .element(screen.getByRole('button', { name: TRIGGER_NAME }))
        .not.toHaveTextContent(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      expect(form.checkValidity()).toBe(false);
    });
  });

  describe('form', () => {
    it('submits the value through a single input while the calendar is open', async () => {
      const screen = await renderPicker(
        <form>
          <MonthPicker presentation="popover" name={FIELD_NAME} defaultValue="2026-10" />
        </form>,
      );

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      expect(inputsNamed(FIELD_NAME).map((input) => input.value)).toEqual(['2026-10']);
    });

    it('blocks submission while required and empty and hands validation focus to the trigger', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker presentation="popover" name={FIELD_NAME} required />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      expect(formElementOf(screen.getByRole('form', { name: FORM_LABEL })).checkValidity()).toBe(false);
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      // Constraint: Firefox는 창에 포커스가 없으면 .focus()의 focus 이벤트를 빠뜨릴 때가 있어, 브라우저가 검증 메시지용으로 보내는 focusin을 직접 발생시킴
      hiddenInputNamed(FIELD_NAME).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
    });

    it('returns to the default value on form reset and reports it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker presentation="popover" name={FIELD_NAME} defaultValue="2026-10" onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await screen.getByRole('button', { name: NOVEMBER_NAME }).click();
      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('2026-11');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('2026-10');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['2026-11', VALID_DETAILS],
        ['2026-10', VALID_DETAILS],
      ]);
    });

    it('reports an emptied required value as valid on form reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker presentation="popover" name={FIELD_NAME} required onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await screen.getByRole('button', { name: NOVEMBER_NAME }).click();
      await expect.poll(() => onValueChange.mock.calls.length).toBe(1);

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([null, VALID_DETAILS]);
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <MonthPicker presentation="popover" name={FIELD_NAME} value="2026-11" onValueChange={onValueChange} />
        </form>,
      );

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('2026-11');
    });
  });

  it('has no axe violations while open', async () => {
    const screen = await render(
      <MonthPicker presentation="popover" locale={en} today={FIXED_TODAY} defaultValue="2026-10" />,
    );

    await screen.getByRole('button', { name: endsWith(en.labels.chooseMonth) }).click();
    await expect.element(screen.getByRole('grid')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
