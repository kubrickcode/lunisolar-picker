import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { COARSE_NARROW_SCREEN_QUERY } from '../presentation/use-presentation';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { DatePicker, type TriggerRenderProps } from './index';

const CHIP_PLACEHOLDER = '설치일';
const FIELD_NAME = 'installedOn';
const FORM_LABEL = '설치 정보';
const OUTSIDE_BUTTON_LABEL = '바깥';
const POPOVER_OFFSET_PIXELS = 8;
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const hiddenInputNamed = (name: string): HTMLInputElement => {
  const inputs = inputsNamed(name);
  const [input] = inputs;
  if (inputs.length !== 1 || !input) throw new Error(`expected one input named ${name}, found ${inputs.length}`);
  return input;
};

const inputsNamed = (name: string): HTMLInputElement[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

const renderChipTrigger = ({ displayValue, placeholder, triggerProps }: TriggerRenderProps): ReactElement => (
  <button {...triggerProps} type="button" data-testid="chip">
    {displayValue || placeholder}
  </button>
);

const renderPicker = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

// Goal: 터치 기기의 좁은 화면 판정만 참이 되게 함. 다른 미디어 질의는 그대로 거짓
const stubCoarseNarrowScreen = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
    matches: query === COARSE_NARROW_SCREEN_QUERY,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));

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
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('20');
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

  describe('presentation', () => {
    it('opens as a sheet on a coarse narrow screen by default', async () => {
      const matchMedia = stubCoarseNarrowScreen();
      try {
        const screen = await renderPicker(<DatePicker />);

        await screen.getByRole('button', { name: ko.labels.chooseDate }).click();

        await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      } finally {
        matchMedia.mockRestore();
      }
    });

    it('opens as a sheet when asked and points the trigger at it', async () => {
      const screen = await renderPicker(<DatePicker presentation="sheet" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDate });
      // Constraint: 시트가 열리면 형제가 inert라 역할로 다시 찾을 수 없으므로 요소를 미리 잡아 둠
      const triggerElement = trigger.element();

      await trigger.click();

      const dialog = screen.getByRole('dialog');
      await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
      expect(triggerElement.getAttribute('aria-controls')).toBe(dialog.element().id);
      await userEvent.keyboard('{Escape}');
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(trigger).not.toHaveAttribute('aria-controls');
    });

    it('closes the sheet from its close button and returns focus to the trigger', async () => {
      const screen = await renderPicker(<DatePicker presentation="sheet" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDate });
      await focusOnce(trigger);

      await trigger.click();
      await screen.getByRole('button', { name: ko.labels.close }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
    });

    it('leaves the close button to the confirm footer in confirm mode', async () => {
      const screen = await renderPicker(<DatePicker presentation="sheet" commitMode="confirm" />);

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();

      await expect.element(screen.getByRole('button', { name: ko.labels.cancel })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: ko.labels.close })).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', 'popover', { disabled: true }],
      ['read-only', 'popover', { readOnly: true }],
      ['disabled', 'sheet', { disabled: true }],
    ] as const)('cannot be opened while %s as a %s', async (_, presentation, stateProps) => {
      const screen = await renderPicker(<DatePicker presentation={presentation} {...stateProps} />);

      await expect.element(screen.getByRole('button', { name: ko.labels.chooseDate })).toBeDisabled();
    });
  });

  describe('field', () => {
    it('writes the value with the given separator', async () => {
      const screen = await renderPicker(
        <DatePicker presentation="popover" aria-label={CHIP_PLACEHOLDER} defaultValue="2026-10-20" separator="-" />,
      );

      await expect.element(screen.getByRole('group', { name: CHIP_PLACEHOLDER })).toHaveTextContent('2026-10-20');
    });

    it('tells two pickers apart by the labels they are given', async () => {
      const screen = await renderPicker(
        <>
          <DatePicker presentation="popover" aria-label="시작일" />
          <DatePicker presentation="popover" aria-label="종료일" />
        </>,
      );

      await expect.element(screen.getByRole('group', { name: '시작일' })).toBeVisible();
      await expect.element(screen.getByRole('group', { name: '종료일' })).toBeVisible();
      await screen.getByRole('button', { name: ko.labels.chooseDate }).last().click();
      await expect.element(screen.getByRole('dialog', { name: '종료일' })).toBeVisible();
    });

    it('reports leaving the field once', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <DatePicker presentation="popover" onBlur={onBlur} />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.year }));
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.day }));
      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });

    it('reports an unreadable value once, not again when the calendar opens', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <DatePicker presentation="popover" value="2026-02-30" onInvalidValue={onInvalidValue} />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['2026-02-30', 'invalid-date']]);
    });

    it('focuses the first segment through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<DatePicker presentation="popover" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).toHaveFocus();
    });

    it('marks the picker invalid when the value breaks a limit', async () => {
      const screen = await renderPicker(
        <>
          <DatePicker presentation="popover" defaultValue="2026-10-20" max="2026-10-10" />
          <DatePicker presentation="popover" defaultValue="2026-10-05" max="2026-10-10" />
        </>,
      );
      const [outOfRange, withinRange] = Array.from(
        screen.container.querySelectorAll<HTMLElement>('[data-lsp-part="date-picker"]'),
      );

      expect(outOfRange?.hasAttribute('data-invalid')).toBe(true);
      expect(withinRange?.hasAttribute('data-invalid')).toBe(false);
    });
  });

  describe('app trigger', () => {
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

    it('anchors the popover to the app trigger and tells it the open state', async () => {
      const screen = await renderPicker(
        <div style={{ paddingBlockStart: 30, paddingInlineStart: 40 }}>
          <DatePicker
            presentation="popover"
            placeholder={CHIP_PLACEHOLDER}
            renderTrigger={({ displayValue, isOpen, placeholder, triggerProps }) => (
              <button {...triggerProps} type="button" data-testid="chip">
                {`${displayValue || placeholder}${isOpen ? ' (열림)' : ''}`}
              </button>
            )}
          />
        </div>,
      );
      const chip = screen.getByTestId('chip');

      await chip.click();

      const dialog = screen.getByRole('dialog');
      await expect.element(chip).toHaveTextContent(`${CHIP_PLACEHOLDER} (열림)`);
      await expect.element(chip).toHaveAttribute('aria-expanded', 'true');
      const chipRect = chip.element().getBoundingClientRect();
      await expect
        .poll(() => Math.round(dialog.element().getBoundingClientRect().left))
        .toBe(Math.round(chipRect.left));
      await expect
        .poll(() => Math.round(dialog.element().getBoundingClientRect().top))
        .toBe(Math.round(chipRect.bottom + POPOVER_OFFSET_PIXELS));
    });

    it('forwards the labels and id to the app trigger', async () => {
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          id="installed-on"
          aria-label="설치일 고르기"
          aria-describedby="installed-on-hint"
          renderTrigger={renderChipTrigger}
        />,
      );

      const chip = screen.getByRole('button', { name: '설치일 고르기' });
      await expect.element(chip).toHaveAttribute('id', 'installed-on');
      await expect.element(chip).toHaveAttribute('aria-describedby', 'installed-on-hint');
    });

    it('focuses the app trigger through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(
        <DatePicker
          presentation="popover"
          placeholder={CHIP_PLACEHOLDER}
          ref={ref}
          renderTrigger={renderChipTrigger}
        />,
      );
      const chip = screen.getByRole('button', { name: CHIP_PLACEHOLDER });
      await focusOnce(chip);
      const chipElement = chip.element();
      if (chipElement instanceof HTMLElement) chipElement.blur();
      await expect.element(chip).not.toHaveFocus();

      ref.current?.focus();

      await expect.element(chip).toHaveFocus();
    });

    it('reports an unreadable value once, not again on opening or on a new inline callback', async () => {
      const onInvalidValue = vi.fn();
      // Goal: 앱이 렌더마다 새 인라인 콜백을 넘겨도 같은 값은 다시 알리지 않는지 봄
      const renderWithInlineCallback = () => (
        <KoreanProvider>
          <DatePicker
            presentation="popover"
            placeholder={CHIP_PLACEHOLDER}
            value="2026-02-30"
            onInvalidValue={(input, reason) => onInvalidValue(input, reason)}
            renderTrigger={renderChipTrigger}
          />
        </KoreanProvider>
      );
      const screen = await render(renderWithInlineCallback());
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: CHIP_PLACEHOLDER }).click();
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await screen.rerender(renderWithInlineCallback());
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['2026-02-30', 'invalid-date']]);
    });

    it('reports leaving the closed trigger but not moving into the popover', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <DatePicker
            presentation="popover"
            placeholder={CHIP_PLACEHOLDER}
            onBlur={onBlur}
            renderTrigger={renderChipTrigger}
          />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );
      const chip = screen.getByRole('button', { name: CHIP_PLACEHOLDER });
      await focusOnce(chip);

      await chip.click();
      await expect.element(screen.getByRole('button', { name: dayLabel(FIXED_TODAY) })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      await expect.element(chip).toHaveFocus();
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();

      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));
      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });
  });

  describe('form', () => {
    it('submits the value through a single input while the calendar is open', async () => {
      const screen = await renderPicker(
        <form>
          <DatePicker presentation="popover" name={FIELD_NAME} defaultValue="2026-10-20" />
        </form>,
      );

      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      expect(inputsNamed(FIELD_NAME).map((input) => input.value)).toEqual(['2026-10-20']);
    });

    it('belongs to the form it names and marks the field required', async () => {
      const screen = await renderPicker(
        <>
          <form id="outside-form" aria-label={FORM_LABEL} />
          <DatePicker presentation="popover" name={FIELD_NAME} form="outside-form" required />
        </>,
      );

      expect(hiddenInputNamed(FIELD_NAME).form).toBe(formElementOf(screen.getByRole('form', { name: FORM_LABEL })));
      expect(hiddenInputNamed(FIELD_NAME).required).toBe(true);
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }))
        .toHaveAttribute('aria-required', 'true');
    });

    it.each([
      ['field', undefined, ko.labels.year, 'spinbutton'],
      ['app trigger', renderChipTrigger, CHIP_PLACEHOLDER, 'button'],
    ] as const)('hands validation focus to the %s', async (_, renderTrigger, focusTargetName, role) => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DatePicker
            presentation="popover"
            name={FIELD_NAME}
            placeholder={CHIP_PLACEHOLDER}
            required
            renderTrigger={renderTrigger}
          />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      // Constraint: Firefox는 창에 포커스가 없으면 .focus()의 focus 이벤트를 빠뜨릴 때가 있어, 브라우저가 검증 메시지용으로 보내는 focusin을 직접 발생시킴
      hiddenInputNamed(FIELD_NAME).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      await expect.element(screen.getByRole(role, { name: focusTargetName })).toHaveFocus();
    });

    it('returns to the default value on form reset and reports it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DatePicker
            presentation="popover"
            name={FIELD_NAME}
            defaultValue="2026-10-01"
            onValueChange={onValueChange}
          />
        </form>,
      );
      await screen.getByRole('button', { name: ko.labels.chooseDate }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('20');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('01');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        ['2026-10-20', VALID_DETAILS],
        ['2026-10-01', VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('2026-10-01');
    });

    it('clears a half-typed date on form reset', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DatePicker presentation="popover" name={FIELD_NAME} />
        </form>,
      );
      const year = screen.getByRole('spinbutton', { name: ko.labels.year });
      await clickToFocus(year);
      await userEvent.keyboard('2026');
      await expect.element(year).toHaveTextContent('2026');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year })).not.toHaveTextContent('2026');
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DatePicker presentation="popover" name={FIELD_NAME} value="2026-10-20" onValueChange={onValueChange} />
        </form>,
      );

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('2026-10-20');
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day })).toHaveTextContent('20');
    });

    it('submits through an app trigger and blocks submission while required and empty', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DatePicker
            presentation="popover"
            name={FIELD_NAME}
            placeholder={CHIP_PLACEHOLDER}
            required
            renderTrigger={renderChipTrigger}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(false);

      await screen.getByRole('button', { name: CHIP_PLACEHOLDER }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();

      await expect.poll(() => new FormData(form).get(FIELD_NAME)).toBe('2026-10-20');
      expect(form.checkValidity()).toBe(true);
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
