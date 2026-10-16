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
  endsWith,
  hiddenInputNamed,
  inputsNamed,
  openSheet,
  pressWithKeyboard,
  renderChipTrigger,
} from '../testing/picker-fixture';
import { settleEffects } from '../testing/settle-effects';
import { WheelDatePicker } from './index';

const CHIP_PLACEHOLDER = '생년월일';
const FIELD_NAME = 'bornOn';
const FORM_LABEL = '가입 정보';
const OUTSIDE_BUTTON_LABEL = '바깥';
// Goal: 시트 트리거 이름은 "보이는 값 + 동작 라벨"이므로 동작 라벨로 끝나는지로 찾음
const TRIGGER_NAME = endsWith(ko.labels.chooseDate);
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

describe('WheelDatePicker', () => {
  describe('inline', () => {
    it('renders year, month and day columns inline', async () => {
      const screen = await renderPicker(<WheelDatePicker defaultValue="1990-03-15" />);

      expect(screen.getByRole('spinbutton').all()).toHaveLength(3);
      await expect.element(screen.getByRole('group', { name: ko.labels.chooseDate })).toBeVisible();
    });

    it('reports a turned column at once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<WheelDatePicker defaultValue="1990-03-15" onValueChange={onValueChange} />);

      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.year }));
      await userEvent.keyboard('{ArrowUp}');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['1989-03-15', VALID_DETAILS]]);
    });

    it('forwards the labels and id to the wheel', async () => {
      const screen = await renderPicker(
        <WheelDatePicker id="born-on" aria-label="생일" aria-describedby="born-hint" />,
      );
      const wheel = screen.getByRole('group', { name: '생일' });

      await expect.element(wheel).toHaveAttribute('id', 'born-on');
      await expect.element(wheel).toHaveAttribute('aria-describedby', 'born-hint');
    });

    it.each([
      ['disabled', { disabled: true }, 'aria-disabled'],
      ['read-only', { readOnly: true }, 'aria-readonly'],
    ] as const)('passes %s to every column', async (_, stateProps, attribute) => {
      const screen = await renderPicker(<WheelDatePicker {...stateProps} />);

      const columns = screen.getByRole('spinbutton').all();
      expect(columns).toHaveLength(3);
      await Promise.all(columns.map((column) => expect.element(column).toHaveAttribute(attribute, 'true')));
    });

    it('focuses the first column through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<WheelDatePicker ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toHaveFocus();
    });

    it('reports leaving the wheel once', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <WheelDatePicker onBlur={onBlur} />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.year }));
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.day }));
      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });

    it('reports an unreadable value once', async () => {
      const onInvalidValue = vi.fn();
      await renderPicker(<WheelDatePicker value="1990-02-30" onInvalidValue={onInvalidValue} />);

      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);
      await settleEffects();
      expect(onInvalidValue.mock.calls).toEqual([['1990-02-30', 'invalid-date']]);
    });
  });

  describe('sheet', () => {
    it('applies the wheel draft only after confirm in a sheet', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker presentation="sheet" defaultValue="1990-03-15" onValueChange={onValueChange} />,
      );

      await openSheet({
        trigger: screen.getByRole('button', { name: TRIGGER_NAME }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      const yearColumn = screen.getByRole('spinbutton', { name: ko.labels.year });
      await focusDirectly(yearColumn);
      await userEvent.keyboard('{ArrowUp}');
      // Constraint: 휠은 정착 애니메이션(220ms)이 끝난 뒤 값을 확정하므로 확인 전에 확정을 기다림 (preflight 2.11). aria-valuenow는 연도가 아니라 항목 순번이라 보이는 글자로 기다림
      await expect.element(yearColumn).toHaveAttribute('aria-valuetext', '1989');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();

      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange).toHaveBeenCalledWith('1989-03-15', VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('confirms the shown date when the wheel was not turned', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<WheelDatePicker presentation="sheet" onValueChange={onValueChange} />);

      await openSheet({
        trigger: screen.getByRole('button', { name: TRIGGER_NAME }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange.mock.calls).toEqual([[FIXED_TODAY, VALID_DETAILS]]);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('confirms the date clamped into the limits for a value outside them', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker
          presentation="sheet"
          value="1990-03-15"
          min="2000-01-01"
          max="2010-12-31"
          onValueChange={onValueChange}
        />,
      );

      await openSheet({
        trigger: screen.getByRole('button', { name: TRIGGER_NAME }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      expect(onValueChange.mock.calls).toEqual([['2000-01-01', VALID_DETAILS]]);
    });

    it('starts the draft on the clamped date without marking it invalid', async () => {
      const screen = await renderPicker(
        <WheelDatePicker presentation="sheet" value="1990-03-15" min="2000-01-01" max="2010-12-31" />,
      );

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();

      const yearColumn = screen.getByRole('spinbutton', { name: ko.labels.year });
      await expect.element(yearColumn).toHaveAttribute('aria-valuetext', '2000');
      await expect.element(yearColumn).not.toHaveAttribute('aria-invalid');
      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeEnabled();
    });

    it('disables confirm when the limits leave no day to pick', async () => {
      const screen = await renderPicker(<WheelDatePicker presentation="sheet" min="2010-01-01" max="2000-01-01" />);

      await screen.getByRole('button', { name: TRIGGER_NAME }).click();

      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
    });

    it('closes on confirm without reporting the value it already has', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker presentation="sheet" defaultValue="1990-03-15" onValueChange={onValueChange} />,
      );

      await openSheet({
        trigger: screen.getByRole('button', { name: TRIGGER_NAME }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('drops the draft on cancel and shows the committed date on reopening', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker presentation="sheet" defaultValue="1990-03-15" onValueChange={onValueChange} />,
      );
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });

      await openSheet({ trigger, initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }) });
      const yearColumn = screen.getByRole('spinbutton', { name: ko.labels.year });
      await focusDirectly(yearColumn);
      await userEvent.keyboard('{ArrowUp}');
      await expect.element(yearColumn).toHaveAttribute('aria-valuetext', '1989');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.cancel }));
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await trigger.click();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }))
        .toHaveAttribute('aria-valuetext', '1990');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('shows the value in the trigger with the given separator', async () => {
      const screen = await renderPicker(
        <WheelDatePicker presentation="sheet" defaultValue="1990-03-15" separator="-" />,
      );

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent('1990-03-15');
    });

    it('names the sheet after the given label and focuses the trigger through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<WheelDatePicker presentation="sheet" aria-label="생일" ref={ref} />);
      const trigger = screen.getByRole('button', { name: '생일' });

      ref.current?.focus();
      await expect.element(trigger).toHaveFocus();
      await trigger.click();

      await expect.element(screen.getByRole('dialog', { name: '생일' })).toBeVisible();
    });

    it('renders an app trigger and reports an unreadable value once through it', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker
          presentation="sheet"
          placeholder={CHIP_PLACEHOLDER}
          value="1990-02-30"
          onInvalidValue={onInvalidValue}
          renderTrigger={renderChipTrigger}
        />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: CHIP_PLACEHOLDER }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['1990-02-30', 'invalid-date']]);
    });

    it('cannot be opened or focused while disabled', async () => {
      const screen = await renderPicker(<WheelDatePicker presentation="sheet" disabled />);

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toBeDisabled();
    });

    it('keeps the read-only sheet trigger focusable through the ref without opening the sheet', async () => {
      const ref = createRef<{ focus(): void }>();
      const onOpenChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker
          presentation="sheet"
          readOnly
          defaultValue="1990-03-15"
          ref={ref}
          onOpenChange={onOpenChange}
        />,
      );
      const trigger = screen.getByRole('button', { name: TRIGGER_NAME });
      await expect.element(trigger).toHaveAttribute('aria-disabled', 'true');

      ref.current?.focus();
      await expect.element(trigger).toHaveFocus();
      await trigger.click({ force: true });
      await settleEffects();

      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it.each([
      ['with a value', { defaultValue: '1990-03-15' }, true],
      ['while empty', {}, false],
      ['while disabled', { defaultValue: '1990-03-15', disabled: true }, false],
      ['while read-only', { defaultValue: '1990-03-15', readOnly: true }, false],
      ['when turned off', { defaultValue: '1990-03-15', isClearable: false }, false],
    ] as const)('shows the sheet clear button %s', async (_, stateProps, isShown) => {
      const screen = await renderPicker(<WheelDatePicker presentation="sheet" {...stateProps} />);
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toBeInTheDocument();

      const clear = screen.getByRole('button', { name: ko.labels.clear });
      if (isShown) await expect.element(clear).toBeVisible();
      else await expect.element(clear).not.toBeInTheDocument();
    });

    it('empties a sheet value once, returns focus to the trigger and leaves a required form invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelDatePicker
            presentation="sheet"
            name={FIELD_NAME}
            required
            placeholder={CHIP_PLACEHOLDER}
            defaultValue="1990-03-15"
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(true);

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveFocus();
      await expect.element(screen.getByRole('button', { name: TRIGGER_NAME })).toHaveTextContent(CHIP_PLACEHOLDER);
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      expect(form.checkValidity()).toBe(false);
    });

    it('empties an inline value and moves focus to the first column of the reset wheel', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <WheelDatePicker name={FIELD_NAME} defaultValue="1990-03-15" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toHaveFocus();
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }))
        .toHaveAttribute('aria-valuetext', FIXED_TODAY.slice(0, 4));
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });
  });

  describe('form', () => {
    it.each(['inline', 'sheet'] as const)(
      'keeps an uncontrolled %s value as the same gregorian day when its calendar is removed',
      async (presentation) => {
        const onInvalidValue = vi.fn();
        const onValueChange = vi.fn();
        const pickerIn = (hasLunar: boolean) => (
          <KoreanProvider hasLunar={hasLunar}>
            <WheelDatePicker
              presentation={presentation}
              name={FIELD_NAME}
              defaultValue="1990-06-22[u-ca=dangi]"
              onInvalidValue={onInvalidValue}
              onValueChange={onValueChange}
            />
          </KoreanProvider>
        );
        const screen = await render(pickerIn(true));
        await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('1990-06-22[u-ca=dangi]');

        await screen.rerender(pickerIn(false));

        await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('1990-06-22');
        await settleEffects();
        expect(onInvalidValue).not.toHaveBeenCalled();
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['inline', 'inline'],
      ['sheet', 'sheet'],
    ] as const)('submits the value through a single input %s', async (_, presentation) => {
      const screen = await renderPicker(
        <form>
          <WheelDatePicker presentation={presentation} name={FIELD_NAME} defaultValue="1990-03-15" />
        </form>,
      );
      if (presentation === 'sheet') await screen.getByRole('button', { name: TRIGGER_NAME }).click();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toBeVisible();

      expect(inputsNamed(FIELD_NAME).map((input) => input.value)).toEqual(['1990-03-15']);
    });

    it('blocks submission while required and empty and hands validation focus to the wheel', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelDatePicker name={FIELD_NAME} required />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      expect(formElementOf(screen.getByRole('form', { name: FORM_LABEL })).checkValidity()).toBe(false);
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      // Constraint: Firefox는 창에 포커스가 없으면 .focus()의 focus 이벤트를 빠뜨릴 때가 있어, 브라우저가 검증 메시지용으로 보내는 focusin을 직접 발생시킴
      hiddenInputNamed(FIELD_NAME).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toHaveFocus();
    });

    it('returns to the default value on form reset and reports it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelDatePicker name={FIELD_NAME} defaultValue="1990-03-15" onValueChange={onValueChange} />
        </form>,
      );
      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.year }));
      await userEvent.keyboard('{ArrowUp}');
      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('1989-03-15');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }))
        .toHaveAttribute('aria-valuetext', '1990');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['1989-03-15', VALID_DETAILS],
        ['1990-03-15', VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('1990-03-15');
    });

    it('shows today again after a form reset to an empty default', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelDatePicker name={FIELD_NAME} onValueChange={onValueChange} />
        </form>,
      );
      await focusDirectly(screen.getByRole('spinbutton', { name: ko.labels.year }));
      await userEvent.keyboard('{ArrowUp}');
      await expect.poll(() => hiddenInputNamed(FIELD_NAME).value).toBe('2025-10-14');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }))
        .toHaveAttribute('aria-valuetext', '2026');
      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([null, VALID_DETAILS]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <WheelDatePicker name={FIELD_NAME} value="1990-03-15" onValueChange={onValueChange} />
        </form>,
      );

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('1990-03-15');
    });
  });

  it('has no axe violations on the value trigger and with the sheet open', async () => {
    const screen = await render(
      <WheelDatePicker presentation="sheet" locale={en} today={FIXED_TODAY} defaultValue="1990-03-15" />,
    );
    const trigger = screen.getByRole('button', { name: endsWith(en.labels.chooseDate) });
    // Constraint: 시트가 열리면 트리거가 inert라 axe가 보지 않으므로 닫힌 트리거를 먼저 검사함
    await expectNoAxeViolations(screen.container);

    await trigger.click();
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });

  it('has no axe violations inline', async () => {
    const screen = await render(<WheelDatePicker locale={en} today={FIXED_TODAY} defaultValue="1990-03-15" />);
    await expect.element(screen.getByRole('group', { name: en.labels.chooseDate })).toBeVisible();

    await expectNoAxeViolations(screen.container);
  });
});
