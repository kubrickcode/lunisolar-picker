import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { formElementOf } from '../testing/form-element';
import { KoreanProvider } from '../testing/korean-fixture';
import { endsWith, hiddenInputNamed, openSheet, pressWithKeyboard } from '../testing/picker-fixture';
import { settleEffects } from '../testing/settle-effects';
import { WheelTimePicker } from './index';

const FIELD_NAME = 'birthTime';
const FORM_LABEL = '가입 정보';
const PICKER_SELECTOR = '[data-lsp-part="wheel-time-picker"]';
// Goal: 시트 트리거 이름은 "보이는 값 + 동작 라벨"이므로 동작 라벨로 끝나는지로 찾음
const TRIGGER_NAME = endsWith(ko.labels.chooseTime);
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

describe('WheelTimePicker', () => {
  describe('inline', () => {
    it('reports HH:mm when a column turns', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<WheelTimePicker defaultValue="09:30" onValueChange={onValueChange} />);

      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.minute }));
      await userEvent.keyboard('{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['09:31', VALID_DETAILS]]);
    });

    it('focuses the hour column through ref.focus()', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<WheelTimePicker ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveFocus();
    });
  });

  describe('sheet', () => {
    const openTimeSheet = async (screen: Awaited<ReturnType<typeof renderPicker>>): Promise<void> =>
      openSheet({
        trigger: screen.getByRole('button', { name: TRIGGER_NAME }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.hour }),
      });

    // Constraint: 휠은 정착 애니메이션이 끝난 뒤 값을 확정하므로 보이는 글자로 정착을 기다림 (preflight 2.11)
    const turnHourDown = async (
      screen: Awaited<ReturnType<typeof renderPicker>>,
      expectedHour: string,
    ): Promise<void> => {
      const hourColumn = screen.getByRole('spinbutton', { name: ko.labels.hour });
      await focusDirectly(hourColumn);
      await userEvent.keyboard('{ArrowDown}');
      await expect.element(hourColumn).toHaveAttribute('aria-valuetext', expectedHour);
      await settleEffects();
    };

    it('keeps the value when the draft is cancelled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker presentation="sheet" defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await openTimeSheet(screen);
      await turnHourDown(screen, '10');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.cancel }));

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent('09:30');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('commits the draft on confirm', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker presentation="sheet" defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await openTimeSheet(screen);
      await turnHourDown(screen, '10');
      expect(onValueChange).not.toHaveBeenCalled();
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange.mock.calls).toEqual([['10:30', VALID_DETAILS]]);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('commits 12:00 when confirming an empty value without turning', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<WheelTimePicker presentation="sheet" onValueChange={onValueChange} />);

      await openTimeSheet(screen);
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange.mock.calls).toEqual([['12:00', VALID_DETAILS]]);
    });

    it('commits the floored minute for an off-step value', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker presentation="sheet" defaultValue="09:07" minuteStep={5} onValueChange={onValueChange} />,
      );

      await openTimeSheet(screen);
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange.mock.calls).toEqual([['09:05', VALID_DETAILS]]);
    });

    it('opens a fresh draft each time', async () => {
      const screen = await renderPicker(<WheelTimePicker presentation="sheet" defaultValue="09:30" />);

      await openTimeSheet(screen);
      await turnHourDown(screen, '10');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.cancel }));
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await screen.getByRole('button', { name: TRIGGER_NAME }).click();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.hour }))
        .toHaveAttribute('aria-valuetext', '09');
    });

    it('keeps the draft when the parent changes the value while open', async () => {
      const onValueChange = vi.fn();
      const pickerWith = (value: string) => (
        <KoreanProvider>
          <WheelTimePicker presentation="sheet" value={value} onValueChange={onValueChange} />
        </KoreanProvider>
      );
      const screen = await render(pickerWith('09:30'));

      await openTimeSheet(screen);
      await turnHourDown(screen, '10');
      await screen.rerender(pickerWith('15:00'));

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.hour }))
        .toHaveAttribute('aria-valuetext', '10');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.cancel }));

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent('15:00');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('focuses the trigger through ref.focus()', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<WheelTimePicker presentation="sheet" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
    });
  });

  describe('value parsing', () => {
    it('reports a malformed controlled value once and submits an empty field', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker name={FIELD_NAME} value="25:00" onInvalidValue={onInvalidValue} />,
      );

      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);
      await settleEffects();
      expect(onInvalidValue.mock.calls).toEqual([['25:00', 'invalid-time']]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.hour }))
        .toHaveAttribute('aria-valuetext', '12');
    });

    it('marks 24:00 invalid without onInvalidValue', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker presentation="sheet" name={FIELD_NAME} value="24:00" onInvalidValue={onInvalidValue} />,
      );

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent('24:00');
      await expect.element(screen.getByRole('button', { name: ko.labels.clear })).toBeVisible();
      expect(screen.container.querySelector(PICKER_SELECTOR)?.hasAttribute('data-invalid')).toBe(true);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      await settleEffects();
      expect(onInvalidValue).not.toHaveBeenCalled();
    });

    it('marks the inline wheel invalid for 24:00', async () => {
      const screen = await renderPicker(<WheelTimePicker value="24:00" />);

      await expect.element(screen.getByRole('group', { name: ko.labels.chooseTime })).toHaveAttribute('data-invalid');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.hour }))
        .toHaveAttribute('aria-valuetext', '12');
    });
  });

  describe('clear', () => {
    it('clears to null and rests the inline wheel at 12:00', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker name={FIELD_NAME} defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      const hourColumn = screen.getByRole('spinbutton', { name: ko.labels.hour });
      await expect.element(hourColumn).toHaveFocus();
      await expect.element(hourColumn).toHaveAttribute('aria-valuetext', '12');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.minute }))
        .toHaveAttribute('aria-valuetext', '00');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });

    it('clears a sheet value and returns focus to the trigger', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelTimePicker presentation="sheet" name={FIELD_NAME} defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
      await expect.element(screen.getByRole('button', { name: ko.labels.clear })).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });
  });

  describe('form', () => {
    it('blocks submit while required and empty', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelTimePicker name={FIELD_NAME} required />
        </form>,
      );

      expect(formElementOf(screen.getByRole('form', { name: FORM_LABEL })).checkValidity()).toBe(false);
    });

    it('restores the default after reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelTimePicker name={FIELD_NAME} defaultValue="09:30" onValueChange={onValueChange} />
        </form>,
      );
      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.hour }));
      await userEvent.keyboard('{ArrowDown}');
      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('10:30');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.hour }))
        .toHaveAttribute('aria-valuetext', '09');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.minute }))
        .toHaveAttribute('aria-valuetext', '30');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['10:30', VALID_DETAILS],
        ['09:30', VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('09:30');
    });

    it('reports an empty form value when reset returns to a 24:00 default', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelTimePicker name={FIELD_NAME} defaultValue="24:00" onValueChange={onValueChange} />
        </form>,
      );
      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.hour }));
      await userEvent.keyboard('{ArrowDown}');
      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('13:00');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.poll(() => screen.container.querySelector(PICKER_SELECTOR)?.hasAttribute('data-invalid')).toBe(true);
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['13:00', VALID_DETAILS],
        [null, VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });

    it('drops the field from FormData while disabled and keeps the value', async () => {
      const pickerIn = (isDisabled: boolean) => (
        <KoreanProvider>
          <form aria-label={FORM_LABEL}>
            <WheelTimePicker presentation="sheet" name={FIELD_NAME} defaultValue="09:30" disabled={isDisabled} />
          </form>
        </KoreanProvider>
      );
      const screen = await render(pickerIn(true));
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));

      expect(new FormData(form).get(FIELD_NAME)).toBeNull();
      await screen.rerender(pickerIn(false));

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent('09:30');
      expect(new FormData(form).get(FIELD_NAME)).toBe('09:30');
    });
  });

  describe('accessibility', () => {
    it('has no axe violations inline and in the open sheet', async () => {
      const inline = await render(<WheelTimePicker locale={en} defaultValue="09:30" />);
      await expect.element(inline.getByRole('group', { name: en.labels.chooseTime })).toBeVisible();
      await expectNoAxeViolations(inline.container);
      await inline.unmount();

      const sheet = await render(<WheelTimePicker presentation="sheet" locale={en} defaultValue="09:30" />);
      // Constraint: 시트가 열리면 트리거가 inert라 axe가 보지 않으므로 닫힌 트리거를 먼저 검사함
      await expectNoAxeViolations(sheet.container);
      await sheet.getByRole('button', { name: endsWith(en.labels.chooseTime) }).click();
      await expect.element(sheet.getByRole('dialog')).toBeVisible();

      await expectNoAxeViolations(document.body);
    });
  });
});
