import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { hiddenInputNamed, inputsNamed, renderChipTrigger, stubCoarseNarrowScreen } from '../testing/picker-fixture';
import { dispatchPointer } from '../testing/pointer';
import { settleEffects } from '../testing/settle-effects';
import { DateRangePicker, usePickerSelection } from './index';

const APPLY_LABEL = '적용';
const CHIP_PLACEHOLDER = '조회 기간';
const DRAFT_READOUT_ID = 'draft-readout';
const END_NAME = 'to';
const FORM_LABEL = '조회 조건';
const LAST_WEEK_LABEL = '지난 7일';
const OUTSIDE_BUTTON_LABEL = '바깥';
const RANGE = { start: '2026-10-13', end: '2026-10-17' };
const REVERT_LABEL = '되돌리기';
const SELECTED_END_SELECTOR = '[data-lsp-part="calendar-cell"][data-selected] > button';
const START_NAME = 'from';
const UNREADABLE_PRESET_LABEL = '잘못된 기간';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

type Screen = Awaited<ReturnType<typeof render>>;

const AppFooter = (): ReactElement => {
  const selection = usePickerSelection();
  return (
    <div>
      <button type="button" onClick={selection.cancel}>
        {REVERT_LABEL}
      </button>
      <button type="button" onClick={selection.commit}>
        {APPLY_LABEL}
      </button>
    </div>
  );
};

const DraftReadout = (): ReactElement => {
  const { draftRange, validity } = usePickerSelection();
  return (
    <p
      data-testid={DRAFT_READOUT_ID}
    >{`${draftRange?.start ?? ''}/${draftRange?.end ?? ''} ${validity.reasons.join(',')}`}</p>
  );
};

const LastWeekPreset = (): ReactElement => {
  const selection = usePickerSelection();
  return (
    <button type="button" onClick={() => selection.setRange({ start: '2026-10-08', end: '2026-10-14' })}>
      {LAST_WEEK_LABEL}
    </button>
  );
};

const UnreadablePreset = (): ReactElement => {
  const selection = usePickerSelection();
  return (
    <button type="button" onClick={() => selection.setRange({ start: '2026-02-30', end: '2026-03-02' })}>
      {UNREADABLE_PRESET_LABEL}
    </button>
  );
};

const dayButtonOf = (screen: Screen, isoDate: string): HTMLElement => {
  const element = screen.getByRole('button', { name: dayLabel(isoDate) }).element();
  if (!(element instanceof HTMLElement)) throw new Error(`day ${isoDate} should render a button`);
  return element;
};

const openPicker = async (screen: Screen): Promise<void> => {
  await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
};

const renderPicker = (element: ReactElement): Promise<Screen> => render(<KoreanProvider>{element}</KoreanProvider>);

const selectedEndLabels = (screen: Screen): (string | null)[] =>
  Array.from(screen.container.ownerDocument.querySelectorAll(SELECTED_END_SELECTOR), (button) =>
    button.getAttribute('aria-label'),
  );

const tapDay = async (screen: Screen, isoDate: string): Promise<void> => {
  await screen.getByRole('button', { name: dayLabel(isoDate) }).click();
};

describe('DateRangePicker', () => {
  describe('immediate mode', () => {
    it('closes after the second day in immediate mode', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<DateRangePicker presentation="popover" onValueChange={onValueChange} />);

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');

      expect(onValueChange).toHaveBeenCalledWith(RANGE, VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('17');
    });

    it('closes when the selected range is picked again and tells the app without a value change', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker presentation="popover" defaultValue={RANGE} onValueChange={onValueChange} onPick={onPick} />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onPick.mock.calls).toEqual([[RANGE]]);
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('closes after a mouse drag selects a range', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(<DateRangePicker presentation="popover" onValueChange={onValueChange} />);
      await openPicker(screen);

      dispatchPointer(dayButtonOf(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButtonOf(screen, '2026-10-09'), 'pointerover');
      dispatchPointer(document, 'pointerup');

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-06', end: '2026-10-09' }, VALID_DETAILS);
    });

    it('applies a preset and closes', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker presentation="popover" presets={<LastWeekPreset />} onValueChange={onValueChange} />,
      );

      await openPicker(screen);
      await screen.getByRole('button', { name: LAST_WEEK_LABEL }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-08', end: '2026-10-14' }, VALID_DETAILS);
    });

    it('stays open and reports a preset it cannot read', async () => {
      const onInvalidValue = vi.fn();
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          presets={<UnreadablePreset />}
          onInvalidValue={onInvalidValue}
          onValueChange={onValueChange}
        />,
      );

      await openPicker(screen);
      await screen.getByRole('button', { name: UNREADABLE_PRESET_LABEL }).click();

      expect(onInvalidValue.mock.calls).toEqual([['2026-02-30/2026-03-02', 'invalid-date']]);
      await settleEffects();
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('confirm mode', () => {
    it('shows the committed range again after closing a confirm-mode draft by clicking outside', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <>
          <p>outside</p>
          <DateRangePicker
            presentation="popover"
            commitMode="confirm"
            defaultValue={{ start: '2026-10-01', end: '2026-10-03' }}
            onValueChange={onValueChange}
          />
        </>,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await screen.getByText('outside').click();
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await openPicker(screen);

      await expect.poll(() => selectedEndLabels(screen)).toEqual([dayLabel('2026-10-01'), dayLabel('2026-10-03')]);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('lets preset buttons in the presets slot set the draft range', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          presets={<LastWeekPreset />}
          onValueChange={onValueChange}
        />,
      );

      await openPicker(screen);
      await screen.getByRole('button', { name: LAST_WEEK_LABEL }).click();
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-08', end: '2026-10-14' }, VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('disables confirm while the draft breaks maxDays in flag mode', async () => {
      const screen = await renderPicker(
        <DateRangePicker presentation="popover" commitMode="confirm" maxDays={3} limitMode="flag" />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-01');
      await tapDay(screen, '2026-10-03');
      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeEnabled();
      await tapDay(screen, '2026-10-01');
      await tapDay(screen, '2026-10-10');

      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
    });

    it('closes with Escape and keeps the committed value', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          defaultValue={{ start: '2026-10-01', end: '2026-10-03' }}
          onValueChange={onValueChange}
        />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-20');
      await userEvent.keyboard('{Escape}');

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).first()).toHaveTextContent('01');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('drops an unconfirmed range when cancelled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          defaultValue={{ start: '2026-10-01', end: '2026-10-03' }}
          onValueChange={onValueChange}
        />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await screen.getByRole('button', { name: ko.labels.cancel }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('03');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('confirms a range whose end may stay open', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker presentation="popover" commitMode="confirm" isOpenEndAllowed onValueChange={onValueChange} />,
      );

      await openPicker(screen);
      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
      await tapDay(screen, '2026-10-13');
      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: null }, VALID_DETAILS);
    });

    it('labels the footer in the locale given to the picker', async () => {
      const screen = await renderPicker(<DateRangePicker presentation="popover" commitMode="confirm" locale={en} />);

      await screen.getByRole('button', { name: en.labels.chooseDateRange }).click();

      await expect.element(screen.getByRole('button', { name: en.labels.confirm })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: en.labels.cancel })).toBeVisible();
    });
  });

  describe('picker selection', () => {
    it('shows the draft range and its validity to the slots', async () => {
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          maxDays={3}
          limitMode="flag"
          presets={<DraftReadout />}
        />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-01');
      await expect.element(screen.getByTestId(DRAFT_READOUT_ID)).toHaveTextContent('2026-10-01/ incomplete');
      await tapDay(screen, '2026-10-10');

      await expect
        .element(screen.getByTestId(DRAFT_READOUT_ID))
        .toHaveTextContent('2026-10-01/2026-10-10 range-too-long');
    });

    it('cancels and commits from an app footer and closes either way', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          footer={<AppFooter />}
          onValueChange={onValueChange}
        />,
      );

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await screen.getByRole('button', { name: REVERT_LABEL }).click();
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();

      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await screen.getByRole('button', { name: APPLY_LABEL }).click();

      expect(onValueChange).toHaveBeenCalledWith(RANGE, VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['read-only', { readOnly: true }],
      ['disabled', { disabled: true }],
    ] as const)('never shows the presets while %s, even when asked to open', async (_, stateProps) => {
      const onOpenChange = vi.fn();
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          open
          presets={<LastWeekPreset />}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
          {...stateProps}
        />,
      );

      await expect.poll(() => onOpenChange.mock.calls).toEqual([[false]]);
      await expect
        .element(screen.getByRole('button', { name: ko.labels.chooseDateRange }))
        .toHaveAttribute('aria-expanded', 'false');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('cannot be used outside DateRangePicker', () => {
      expect(() => renderToString(<LastWeekPreset />)).toThrow(LunisolarPickerError);
    });
  });

  describe('opening focus', () => {
    it('focuses the start of the selected range', async () => {
      const screen = await renderPicker(<DateRangePicker presentation="popover" defaultValue={RANGE} />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDateRange });
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-13') })).toHaveFocus();
    });

    it('focuses today when nothing is selected', async () => {
      const screen = await renderPicker(<DateRangePicker presentation="popover" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDateRange });
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('button', { name: dayLabel(FIXED_TODAY) })).toHaveFocus();
    });
  });

  describe('presentation', () => {
    it('opens as a sheet on a coarse narrow screen by default', async () => {
      const matchMedia = stubCoarseNarrowScreen();
      try {
        const screen = await renderPicker(<DateRangePicker />);

        await openPicker(screen);

        await expect.element(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      } finally {
        matchMedia.mockRestore();
      }
    });

    it('closes the sheet from its close button and returns focus to the trigger', async () => {
      const screen = await renderPicker(<DateRangePicker presentation="sheet" />);
      const trigger = screen.getByRole('button', { name: ko.labels.chooseDateRange });
      await focusOnce(trigger);

      await trigger.click();
      await screen.getByRole('button', { name: ko.labels.close }).click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(trigger).toHaveFocus();
    });

    it('leaves the close button to the confirm footer in confirm mode', async () => {
      const screen = await renderPicker(<DateRangePicker presentation="sheet" commitMode="confirm" />);

      await openPicker(screen);

      await expect.element(screen.getByRole('button', { name: ko.labels.cancel })).toBeVisible();
      await expect.element(screen.getByRole('button', { name: ko.labels.close })).not.toBeInTheDocument();
    });

    it.each([
      ['disabled', 'popover', { disabled: true }],
      ['read-only', 'popover', { readOnly: true }],
      ['disabled', 'sheet', { disabled: true }],
    ] as const)('cannot be opened while %s as a %s', async (_, presentation, stateProps) => {
      const screen = await renderPicker(<DateRangePicker presentation={presentation} {...stateProps} />);

      await expect.element(screen.getByRole('button', { name: ko.labels.chooseDateRange })).toBeDisabled();
    });
  });

  describe('field', () => {
    it('writes both ends with the given separator', async () => {
      const screen = await renderPicker(
        <DateRangePicker presentation="popover" aria-label={CHIP_PLACEHOLDER} defaultValue={RANGE} separator="-" />,
      );

      await expect
        .element(screen.getByRole('group', { name: CHIP_PLACEHOLDER }))
        .toHaveTextContent(`2026-10-13${ko.rangeSeparator}2026-10-17`);
    });

    it('tells two pickers apart by the labels they are given', async () => {
      const screen = await renderPicker(
        <>
          <DateRangePicker presentation="popover" aria-label="이번 기간" />
          <DateRangePicker presentation="popover" aria-label="지난 기간" />
        </>,
      );

      await expect.element(screen.getByRole('group', { name: '이번 기간' })).toBeVisible();
      await expect.element(screen.getByRole('group', { name: '지난 기간' })).toBeVisible();
      await screen.getByRole('button', { name: ko.labels.chooseDateRange }).last().click();
      await expect.element(screen.getByRole('dialog', { name: '지난 기간' })).toBeVisible();
    });

    it('reports leaving the field once, not while moving between its ends', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <DateRangePicker presentation="popover" onBlur={onBlur} />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </>,
      );

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.year }).first());
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.day }).last());
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();
      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      await expect.poll(() => onBlur.mock.calls.length).toBe(1);
    });

    it('reports an unreadable value once, not again when the calendar opens', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          value={{ start: '2026-02-30', end: '2026-03-02' }}
          onInvalidValue={onInvalidValue}
        />,
      );
      await expect.poll(() => onInvalidValue.mock.calls.length).toBe(1);

      await openPicker(screen);
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['2026-02-30/2026-03-02', 'invalid-date']]);
    });

    it('focuses the first segment of the start through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(<DateRangePicker presentation="popover" ref={ref} />);

      ref.current?.focus();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).first()).toHaveFocus();
    });

    it('marks the picker invalid when the value breaks a limit', async () => {
      const screen = await renderPicker(
        <>
          <DateRangePicker presentation="popover" defaultValue={RANGE} max="2026-10-10" />
          <DateRangePicker
            presentation="popover"
            defaultValue={{ start: '2026-10-01', end: '2026-10-05' }}
            max="2026-10-10"
          />
        </>,
      );
      const [outOfRange, withinRange] = Array.from(
        screen.container.querySelectorAll<HTMLElement>('[data-lsp-part="date-range-picker"]'),
      );

      expect(outOfRange?.hasAttribute('data-invalid')).toBe(true);
      expect(withinRange?.hasAttribute('data-invalid')).toBe(false);
    });
  });

  describe('app trigger', () => {
    it('renders an app trigger with the formatted range', async () => {
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          defaultValue={RANGE}
          separator="-"
          renderTrigger={({ displayValue, triggerProps }) => (
            <button {...triggerProps} type="button">
              {`기간 ${displayValue}`}
            </button>
          )}
        />,
      );

      await expect
        .element(screen.getByRole('button', { name: `기간 2026-10-13${ko.rangeSeparator}2026-10-17` }))
        .toBeVisible();
    });

    it('forwards the labels and id to the app trigger', async () => {
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          id="report-period"
          aria-label="조회 기간 고르기"
          aria-describedby="report-period-hint"
          renderTrigger={renderChipTrigger}
        />,
      );

      const chip = screen.getByRole('button', { name: '조회 기간 고르기' });
      await expect.element(chip).toHaveAttribute('id', 'report-period');
      await expect.element(chip).toHaveAttribute('aria-describedby', 'report-period-hint');
    });

    it('focuses the app trigger through the ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker(
        <DateRangePicker
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
      const renderWithInlineCallback = (): ReactElement => (
        <KoreanProvider>
          <DateRangePicker
            presentation="popover"
            placeholder={CHIP_PLACEHOLDER}
            value={{ start: '2026-02-30', end: null }}
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

      expect(onInvalidValue.mock.calls).toEqual([['2026-02-30/', 'invalid-date']]);
    });

    it('reports leaving the closed trigger but not moving into the popover', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <>
          <DateRangePicker
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

    it.each([
      ['field', undefined],
      ['app trigger', renderChipTrigger],
    ] as const)('parses an unreadable default value silently with the %s', async (_, renderTrigger) => {
      const onInvalidValue = vi.fn();
      const screen = await renderPicker(
        <DateRangePicker
          presentation="popover"
          placeholder={CHIP_PLACEHOLDER}
          defaultValue={{ start: '2026-02-30', end: '2026-03-02' }}
          onInvalidValue={onInvalidValue}
          renderTrigger={renderTrigger}
        />,
      );
      await expect.element(screen.getByRole('button').first()).toBeVisible();
      await settleEffects();

      expect(onInvalidValue).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it.each([
      ['with a range', { defaultValue: RANGE }, true],
      ['while empty', {}, false],
      ['while disabled', { defaultValue: RANGE, disabled: true }, false],
      ['while read-only', { defaultValue: RANGE, readOnly: true }, false],
      ['when turned off', { defaultValue: RANGE, isClearable: false }, false],
    ] as const)('shows the clear button %s', async (_, stateProps, isShown) => {
      const screen = await renderPicker(<DateRangePicker presentation="popover" {...stateProps} />);
      await expect.element(screen.getByRole('button', { name: ko.labels.chooseDateRange })).toBeInTheDocument();

      const clear = screen.getByRole('button', { name: ko.labels.clear });
      if (isShown) await expect.element(clear).toBeVisible();
      else await expect.element(clear).not.toBeInTheDocument();
    });

    it('empties both ends once, returns focus to the start field and leaves a required form invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            required
            defaultValue={RANGE}
            onValueChange={onValueChange}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(true);

      await screen.getByRole('button', { name: ko.labels.clear }).click();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).first()).toHaveFocus();
      await expect.element(screen.getByRole('button', { name: ko.labels.clear })).not.toBeInTheDocument();
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([[null, VALID_DETAILS]]);
      expect(hiddenInputNamed(START_NAME).value).toBe('');
      expect(hiddenInputNamed(END_NAME).value).toBe('');
      expect(form.checkValidity()).toBe(false);
    });
  });

  describe('form', () => {
    it('keeps an uncontrolled range as the same gregorian days when its calendar is removed', async () => {
      const onInvalidValue = vi.fn();
      const onValueChange = vi.fn();
      const pickerIn = (hasLunar: boolean) => (
        <KoreanProvider hasLunar={hasLunar}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            defaultValue={{ start: '2026-10-13[u-ca=dangi]', end: '2026-10-17[u-ca=dangi]' }}
            onInvalidValue={onInvalidValue}
            onValueChange={onValueChange}
          />
        </KoreanProvider>
      );
      const screen = await render(pickerIn(true));
      await expect.poll(() => hiddenInputNamed(START_NAME).value).toBe('2026-10-13[u-ca=dangi]');

      await screen.rerender(pickerIn(false));

      await expect.poll(() => hiddenInputNamed(START_NAME).value).toBe('2026-10-13');
      expect(hiddenInputNamed(END_NAME).value).toBe('2026-10-17');
      await settleEffects();
      expect(onInvalidValue).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('submits each end through a single input while the calendar is open', async () => {
      const screen = await renderPicker(
        <form>
          <DateRangePicker presentation="popover" startName={START_NAME} endName={END_NAME} defaultValue={RANGE} />
        </form>,
      );

      await openPicker(screen);
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      expect(inputsNamed(START_NAME).map((input) => input.value)).toEqual(['2026-10-13']);
      expect(inputsNamed(END_NAME).map((input) => input.value)).toEqual(['2026-10-17']);
    });

    it('belongs to the form it names and marks both ends required', async () => {
      const screen = await renderPicker(
        <>
          <form id="outside-form" aria-label={FORM_LABEL} />
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            form="outside-form"
            required
          />
        </>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));

      expect(hiddenInputNamed(START_NAME).form).toBe(form);
      expect(hiddenInputNamed(END_NAME).form).toBe(form);
      expect(hiddenInputNamed(START_NAME).required).toBe(true);
      expect(hiddenInputNamed(END_NAME).required).toBe(true);
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }).first())
        .toHaveAttribute('aria-required', 'true');
    });

    it('submits a start-only default as empty while the end may not stay open', async () => {
      const screen = await renderPicker(
        <form>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            defaultValue={{ start: '2026-10-13', end: null }}
          />
        </form>,
      );
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).first()).toHaveTextContent('13');

      expect(hiddenInputNamed(START_NAME).value).toBe('');
      expect(hiddenInputNamed(END_NAME).value).toBe('');
      expect(screen.container.querySelector('[data-lsp-part="date-range-picker"]')?.hasAttribute('data-invalid')).toBe(
        false,
      );
    });

    it('reports an empty value once when reset returns to a start-only default', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            defaultValue={{ start: '2026-10-01', end: null }}
            onValueChange={onValueChange}
          />
        </form>,
      );
      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await expect.poll(() => hiddenInputNamed(END_NAME).value).toBe('2026-10-17');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).first()).toHaveTextContent('01');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        [RANGE, VALID_DETAILS],
        [null, VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(START_NAME).value).toBe('');
    });

    it('requires only the start when the end may stay open', async () => {
      await renderPicker(
        <form>
          <DateRangePicker presentation="popover" startName={START_NAME} endName={END_NAME} required isOpenEndAllowed />
        </form>,
      );

      expect(hiddenInputNamed(START_NAME).required).toBe(true);
      expect(hiddenInputNamed(END_NAME).required).toBe(false);
    });

    it.each([
      ['start', 'field', START_NAME, undefined, 'first'],
      ['end', 'field', END_NAME, undefined, 'last'],
      ['start', 'app trigger', START_NAME, renderChipTrigger, 'first'],
    ] as const)('hands validation focus of the %s to the %s', async (_, __, inputName, renderTrigger, position) => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            placeholder={CHIP_PLACEHOLDER}
            required
            renderTrigger={renderTrigger}
          />
          <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
        </form>,
      );
      await focusOnce(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));

      // Constraint: Firefox는 창에 포커스가 없으면 .focus()의 focus 이벤트를 빠뜨릴 때가 있어, 브라우저가 검증 메시지용으로 보내는 focusin을 직접 발생시킴
      hiddenInputNamed(inputName).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      const target = renderTrigger
        ? screen.getByRole('button', { name: CHIP_PLACEHOLDER })
        : screen.getByRole('spinbutton', { name: ko.labels.year })[position]();
      await expect.element(target).toHaveFocus();
    });

    it('returns to the default range on form reset and reports it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            defaultValue={{ start: '2026-10-01', end: '2026-10-03' }}
            onValueChange={onValueChange}
          />
        </form>,
      );
      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('17');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('03');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([
        [RANGE, VALID_DETAILS],
        [{ start: '2026-10-01', end: '2026-10-03' }, VALID_DETAILS],
      ]);
      expect(hiddenInputNamed(START_NAME).value).toBe('2026-10-01');
      expect(hiddenInputNamed(END_NAME).value).toBe('2026-10-03');
    });

    it('clears a half-typed date on form reset', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker presentation="popover" startName={START_NAME} endName={END_NAME} />
        </form>,
      );
      const year = screen.getByRole('spinbutton', { name: ko.labels.year }).first();
      await clickToFocus(year);
      await userEvent.keyboard('2026');
      await expect.element(year).toHaveTextContent('2026');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.year }).first())
        .not.toHaveTextContent('2026');
    });

    it('keeps focus in the field across a form reset without reporting a leave', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker presentation="popover" startName={START_NAME} endName={END_NAME} onBlur={onBlur} />
        </form>,
      );
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.year }).first());
      await userEvent.keyboard('20');

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).first()).toHaveFocus();
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();
    });

    it('reports an emptied required range as valid on form reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            required
            onValueChange={onValueChange}
          />
        </form>,
      );
      await openPicker(screen);
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await expect.poll(() => onValueChange.mock.calls.length).toBe(1);

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();

      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([null, VALID_DETAILS]);
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            value={RANGE}
            onValueChange={onValueChange}
          />
        </form>,
      );

      formElementOf(screen.getByRole('form', { name: FORM_LABEL })).reset();
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputNamed(START_NAME).value).toBe('2026-10-13');
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('17');
    });

    it('submits through an app trigger and blocks submission while required and empty', async () => {
      const screen = await renderPicker(
        <form aria-label={FORM_LABEL}>
          <DateRangePicker
            presentation="popover"
            startName={START_NAME}
            endName={END_NAME}
            placeholder={CHIP_PLACEHOLDER}
            required
            renderTrigger={renderChipTrigger}
          />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form', { name: FORM_LABEL }));
      expect(form.checkValidity()).toBe(false);

      await screen.getByRole('button', { name: CHIP_PLACEHOLDER }).click();
      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');

      await expect.poll(() => new FormData(form).get(END_NAME)).toBe('2026-10-17');
      expect(new FormData(form).get(START_NAME)).toBe('2026-10-13');
      expect(form.checkValidity()).toBe(true);
    });
  });

  it('has no axe violations while open', async () => {
    const screen = await render(
      <DateRangePicker presentation="popover" locale={en} today={FIXED_TODAY} defaultValue={RANGE} />,
    );

    await screen.getByRole('button', { name: en.labels.chooseDateRange }).click();
    await expect.element(screen.getByRole('grid')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
