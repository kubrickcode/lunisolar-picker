import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import {
  hiddenInputNamed,
  inputsNamed,
  openSheet,
  pressWithKeyboard,
  renderChipTrigger,
} from '../testing/picker-fixture';
import { settleEffects } from '../testing/settle-effects';
import { TimePicker } from './index';

const CHIP_PLACEHOLDER = '방송 시각';
const FIELD_NAME = 'airsAt';
const FORM_LABEL = '편성 정보';
const OUTSIDE_BUTTON_LABEL = '바깥';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

describe('TimePicker', () => {
  describe('list', () => {
    it('offers five-minute steps and fills the field from the list', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <TimePicker presentation="popover" minuteStep={5} defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      expect(screen.getByRole('option').all()).toHaveLength(288);
      // Constraint: 288개 목록에서 고를 시각은 화면 밖일 수 있어 클릭 대신 열릴 때 포커스된 옵션에서 키보드로 고름 (preflight 2.10)
      await expect.element(screen.getByRole('option', { name: '09:30' })).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}{Enter}');

      expect(onValueChange).toHaveBeenCalledWith('09:35', VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.minute })).toHaveTextContent('35');
    });

    it('closes when the selected time is picked again without reporting a change', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker(
        <TimePicker presentation="popover" defaultValue="09:30" onValueChange={onValueChange} onPick={onPick} />,
      );

      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      await expect.element(screen.getByRole('option', { name: '09:30' })).toHaveFocus();
      await userEvent.keyboard('{Enter}');

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onPick.mock.calls).toEqual([['09:30']]);
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('offers 24:00 only when the end of day is allowed', async () => {
      const screen = await renderPicker(<TimePicker presentation="popover" isEndOfDayAllowed />);

      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();

      await expect.element(screen.getByRole('option', { name: '24:00' })).toBeInTheDocument();
      expect(screen.getByRole('option').all()).toHaveLength(49);
    });
  });

  describe('field', () => {
    it('reports a typed time', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<TimePicker presentation="popover" onValueChange={onValueChange} />);

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.hour }));
      await userEvent.keyboard('0945');

      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual(['09:45', VALID_DETAILS]);
    });

    it('labels the field with the given labels and names the dialog after them', async () => {
      const screen = await renderPicker(<TimePicker presentation="popover" aria-label="방송 시작" />);

      await expect.element(screen.getByRole('group', { name: '방송 시작' })).toBeVisible();
      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      await expect.element(screen.getByRole('dialog', { name: '방송 시작' })).toBeVisible();
    });

    it('reports leaving the field once', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <TimePicker presentation="popover" onBlur={onBlur} />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.hour }));
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.minute }));
      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });

    it('reports an unreadable value once, not again when the list opens', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <TimePicker presentation="popover" value="9:5" onInvalidValue={onInvalidValue} />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['9:5', 'invalid-time']]);
    });

    it('focuses the first segment through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<TimePicker presentation="popover" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveFocus();
    });

    it('marks the picker invalid for a 24:00 that is not allowed', async () => {
      const screen = await renderPicker(
        <>
          <TimePicker presentation="popover" defaultValue="24:00" />
          <TimePicker presentation="popover" defaultValue="24:00" isEndOfDayAllowed />
        </>,
      );
      const [disallowed, allowed] = Array.from(
        screen.container.querySelectorAll<HTMLElement>('[data-lsp-part="time-picker"]'),
      );

      expect(disallowed?.hasAttribute('data-invalid')).toBe(true);
      expect(allowed?.hasAttribute('data-invalid')).toBe(false);
    });
  });

  describe('presentation', () => {
    it('closes the sheet from its close button', async () => {
      const screen = await renderPicker(<TimePicker presentation="sheet" />);

      await openSheet({
        trigger: screen.getByRole('button', { name: ko.labels.chooseTime }),
        initialFocus: screen.getByRole('option', { name: '00:00' }),
      });
      await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.close }));

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not show the list for an initially open disabled picker', async () => {
      const onOpenChange = vi.fn();
      const screen = await renderPicker(
        <TimePicker presentation="popover" disabled defaultOpen onOpenChange={onOpenChange} />,
      );

      await expect.poll(() => onOpenChange.mock.calls).toEqual([[false]]);
      await expect
        .element(screen.getByRole('button', { name: ko.labels.chooseTime }))
        .toHaveAttribute('aria-expanded', 'false');
      expect(document.querySelector('[role="listbox"]')).toBeNull();
    });

    it('closes the list when the picker becomes disabled while open', async () => {
      const onOpenChange = vi.fn();
      const pickerWith = (isDisabled: boolean) => (
        <KoreanProvider>
          <TimePicker presentation="popover" disabled={isDisabled} defaultOpen onOpenChange={onOpenChange} />
        </KoreanProvider>
      );
      const screen = await render(pickerWith(false));
      await expect.element(screen.getByRole('listbox')).toBeVisible();

      await screen.rerender(pickerWith(true));

      await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      expect(screen.container.querySelector('[data-lsp-part="time-picker"]')?.hasAttribute('data-open')).toBe(false);
    });

    it.each([
      ['disabled', { disabled: true }],
      ['read-only', { readOnly: true }],
    ] as const)('cannot be opened while %s', async (_, stateProps) => {
      const screen = await renderPicker(<TimePicker presentation="popover" {...stateProps} />);

      await expect.element(screen.getByRole('button', { name: ko.labels.chooseTime })).toBeDisabled();
    });
  });

  describe('app trigger', () => {
    it('renders an app trigger with the value in place of the field', async () => {
      const screen = await renderPicker(
        <TimePicker presentation="popover" defaultValue="09:30" renderTrigger={renderChipTrigger} />,
      );

      await expect.element(screen.getByTestId('chip')).toHaveTextContent('09:30');
      expect(screen.container.querySelector('[data-lsp-part="time-field"]')).toBeNull();
    });

    it('forwards the labels to the app trigger and focuses it through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(
        <TimePicker
          presentation="popover"
          id="airs-at"
          aria-label="방송 시각 고르기"
          ref={ref}
          renderTrigger={renderChipTrigger}
        />,
      );
      const chip = screen.getByRole('button', { name: '방송 시각 고르기' });
      await expect.element(chip).toHaveAttribute('id', 'airs-at');

      ref.current?.focus();

      await expect.element(chip).toHaveFocus();
    });

    it('reports an unreadable value once through the app trigger', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <TimePicker
          presentation="popover"
          placeholder={CHIP_PLACEHOLDER}
          value="25:00"
          onInvalidValue={onInvalidValue}
          renderTrigger={renderChipTrigger}
        />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: CHIP_PLACEHOLDER }).click();
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['25:00', 'invalid-time']]);
    });
  });

  describe('clear', () => {
    it.each([
      ['with a value', { defaultValue: '09:30' }, true],
      ['while empty', {}, false],
      ['while disabled', { defaultValue: '09:30', disabled: true }, false],
      ['while read-only', { defaultValue: '09:30', readOnly: true }, false],
      ['when turned off', { defaultValue: '09:30', isClearable: false }, false],
    ] as const)('shows the clear button %s', async (_, stateProps, isShown) => {
      const screen = await renderPicker(<TimePicker presentation="popover" {...stateProps} />);
      await expect.element(screen.getByRole('button', { name: ko.labels.chooseTime })).toBeInTheDocument();

      const clear = screen.getByRole('button', { name: ko.labels.clear });
      if (isShown) await expect.element(clear).toBeVisible();
      else await expect.element(clear).not.toBeInTheDocument();
    });

    it('empties the value once, returns focus to the first segment and leaves a required form invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <TimePicker
            presentation="popover"
            name={FIELD_NAME}
            required
            defaultValue="09:30"
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(true);

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveFocus();
      await expect.element(screen.getByRole('button', { name: ko.labels.clear })).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      expect(form.checkValidity()).toBe(false);
    });
  });

  describe('form', () => {
    it('submits the value through a single input while the list is open', async () => {
      const screen = await renderPicker(
        <form>
          <TimePicker presentation="popover" name={FIELD_NAME} defaultValue="09:30" />
        </form>,
      );

      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      expect(inputsNamed(FIELD_NAME).map((input) => input.value)).toEqual(['09:30']);
    });

    it('submits a 24:00 that is not allowed as empty', async () => {
      await renderPicker(<TimePicker presentation="popover" name={FIELD_NAME} defaultValue="24:00" />);

      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });

    it('hands validation focus to the field', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <TimePicker presentation="popover" name={FIELD_NAME} required />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      expect(formElementOf(screen.getByRole('form', { name: FORM_LABEL })).checkValidity()).toBe(false);
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      // Constraint: Firefox는 창에 포커스가 없으면 .focus()의 focus 이벤트를 빠뜨릴 때가 있어, 브라우저가 검증 메시지용으로 보내는 focusin을 직접 발생시킴
      hiddenInputNamed(FIELD_NAME).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveFocus();
    });

    it('returns to the default value on form reset and reports it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <TimePicker presentation="popover" name={FIELD_NAME} defaultValue="09:30" onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: ko.labels.chooseTime }).click();
      await expect.element(screen.getByRole('option', { name: '09:30' })).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}{Enter}');
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveTextContent('10');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveTextContent('09');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['10:00', VALID_DETAILS],
        ['09:30', VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('09:30');
    });

    it('clears a half-typed time on form reset', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <TimePicker presentation="popover" name={FIELD_NAME} />
        </form>,
      );
      const hour = screen.getByRole('spinbutton', { name: ko.labels.hour });
      await clickToFocus(hour);
      await userEvent.keyboard('09');
      await expect.element(hour).toHaveTextContent('09');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).not.toHaveTextContent('09');
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <TimePicker presentation="popover" name={FIELD_NAME} value="09:30" onValueChange={onValueChange} />
        </form>,
      );

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('09:30');
    });
  });

  it('has no axe violations while open', async () => {
    const screen = await render(
      <TimePicker presentation="popover" locale={en} today={FIXED_TODAY} defaultValue="09:30" />,
    );

    await screen.getByRole('button', { name: en.labels.chooseTime }).click();
    await expect.element(screen.getByRole('listbox')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
