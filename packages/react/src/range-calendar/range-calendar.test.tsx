import { gregory, weekdayOf } from '@lunisolar-picker/calendar';
import { toWeekday, VALID } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { ja } from '@lunisolar-picker/core/locales/ja';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Calendar } from '../calendar/index';
import { LunisolarProvider } from '../settings/lunisolar-provider';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { formElementOf } from '../testing/form-element';
import { dayLabel, epochDayAt, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { RangeCalendar, type UseRangeCalendarProps, useRangeCalendarContext } from './index';

const IN_RANGE_SELECTOR = '[data-lsp-part="calendar-cell"][data-in-range]:not([data-outside])';
const ROOT_SELECTOR = '[data-lsp-part="calendar"]';
const TABBABLE_CELL_SELECTOR = '[data-lsp-part="calendar-cell"] > button[tabindex="0"]';

type ClosableRangeCalendarProps = {
  readonly commitMode: NonNullable<UseRangeCalendarProps['commitMode']>;
  readonly onValueChange: UseRangeCalendarProps['onValueChange'];
};

type Screen = Awaited<ReturnType<typeof render>>;

const renderRangeCalendar = (element: ReactElement): Promise<Screen> =>
  render(<KoreanProvider>{element}</KoreanProvider>);

// Constraint: 범위 달력 칸은 마우스 클릭이 포인터 경로(Task 5)로 가므로, 탭·키보드 선택 경로인 Enter로 고름
const tapDay = async (screen: Screen, isoDate: string): Promise<void> => {
  await focusDirectly(screen.getByRole('button', { name: dayLabel(isoDate) }));
  await userEvent.keyboard('{Enter}');
};

const englishDayLabel = (isoDate: string): string => {
  const epochDay = epochDayAt(isoDate);
  const fields = gregory.fromEpochDay(epochDay);
  if (!fields.isOk) throw new Error(`${isoDate} is outside gregory`);
  return en.formatDayLabel(fields.value, toWeekday(weekdayOf(epochDay)), 'gregory');
};

const hiddenInputOf = (container: HTMLElement, name: string): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`hidden input ${name} is missing`);
  return input;
};

const rootOf = (screen: Screen): Element => {
  const root = screen.container.querySelector(ROOT_SELECTOR);
  if (!root) throw new Error('range calendar root is missing');
  return root;
};

const monthName = (year: number, monthCode: 'M10' | 'M11'): string => ko.formatHeading({ year, monthCode }, 'gregory');

const ConfirmButton = (): ReactElement => {
  const api = useRangeCalendarContext();
  return (
    <button type="button" onClick={() => api.commit()}>
      {ko.labels.confirm}
    </button>
  );
};

const PresetButton = (): ReactElement => {
  const api = useRangeCalendarContext();
  return (
    <button type="button" onClick={() => api.setRange({ start: '2026-10-08', end: '2026-10-14' })}>
      preset
    </button>
  );
};

const ClosingConfirmButton = ({ onClose }: { readonly onClose: () => void }): ReactElement => {
  const api = useRangeCalendarContext();
  return (
    <button
      type="button"
      onClick={() => {
        api.commit();
        onClose();
      }}
    >
      {ko.labels.confirm}
    </button>
  );
};

const ClosableRangeCalendar = ({ commitMode, onValueChange }: ClosableRangeCalendarProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? (
    <RangeCalendar.Root commitMode={commitMode} onValueChange={onValueChange}>
      <Calendar.Layout />
      <ClosingConfirmButton onClose={() => setIsOpen(false)} />
    </RangeCalendar.Root>
  ) : (
    <p>Closed</p>
  );
};

describe('RangeCalendar', () => {
  describe('selection', () => {
    it('completes a range with two selections and emits it once', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root defaultValue={null} onValueChange={onValueChange} />,
      );

      await tapDay(screen, '2026-10-17');
      await tapDay(screen, '2026-10-13');

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
      await expect.poll(() => screen.container.querySelectorAll(IN_RANGE_SELECTOR).length).toBe(5);
    });

    it('marks the range in the grid as multi-selectable', async () => {
      const screen = await renderRangeCalendar(<RangeCalendar.Root />);

      await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    });
  });

  describe('live region', () => {
    it('announces the start and then the summary in a polite live region', async () => {
      const screen = await renderRangeCalendar(<RangeCalendar.Root />);
      const region = screen.getByRole('status');
      await expect.element(region).toHaveAttribute('aria-live', 'polite');

      await tapDay(screen, '2026-10-13');
      await expect.element(region).toHaveTextContent(ko.labels.formatRangeStartSelected(dayLabel('2026-10-13')));

      await tapDay(screen, '2026-10-17');
      await expect
        .element(region)
        .toHaveTextContent(ko.labels.formatRangeSummary(dayLabel('2026-10-13'), dayLabel('2026-10-17'), 5));
    });

    it('reads the strings of the active locale', async () => {
      const screen = await render(
        <LunisolarProvider locale={en} timeZone="Asia/Seoul" today={FIXED_TODAY}>
          <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />
        </LunisolarProvider>,
      );
      const summary = en.labels.formatRangeSummary(englishDayLabel('2026-10-13'), englishDayLabel('2026-10-17'), 5);

      await expect.element(screen.getByRole('status')).toHaveTextContent(summary);
    });
  });

  describe('maxDays', () => {
    it('disables days beyond the limit while selecting in block mode', async () => {
      const screen = await renderRangeCalendar(<RangeCalendar.Root maxDays={3} limitMode="block" />);

      await tapDay(screen, '2026-10-13');

      await expect
        .element(screen.getByRole('button', { name: dayLabel('2026-10-16') }))
        .toHaveAttribute('aria-disabled', 'true');
      await expect
        .element(screen.getByRole('button', { name: dayLabel('2026-10-15') }))
        .not.toHaveAttribute('aria-disabled');
    });

    it('accepts a longer range in flag mode and reports it as invalid', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root maxDays={3} limitMode="flag" onValueChange={onValueChange} />,
      );

      await tapDay(screen, '2026-10-01');
      await tapDay(screen, '2026-10-10');

      expect(onValueChange).toHaveBeenCalledWith(
        { start: '2026-10-01', end: '2026-10-10' },
        { validity: { isValid: false, reasons: ['range-too-long'] } },
      );
      await expect.poll(() => rootOf(screen).hasAttribute('data-invalid')).toBe(true);
    });
  });

  describe('visible invalidity', () => {
    it('does not look invalid while empty or halfway through a range', async () => {
      const screen = await renderRangeCalendar(<RangeCalendar.Root required />);
      await expect.element(screen.getByRole('grid')).toBeVisible();
      expect(rootOf(screen).hasAttribute('data-invalid')).toBe(false);

      await tapDay(screen, '2026-10-13');
      await expect
        .element(screen.getByRole('status'))
        .toHaveTextContent(ko.labels.formatRangeStartSelected(dayLabel('2026-10-13')));

      expect(rootOf(screen).hasAttribute('data-invalid')).toBe(false);
    });

    it('judges the committed range, not an unconfirmed draft', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root commitMode="confirm" maxDays={3} limitMode="flag">
          <Calendar.Layout />
          <ConfirmButton />
        </RangeCalendar.Root>,
      );

      await tapDay(screen, '2026-10-01');
      await tapDay(screen, '2026-10-10');
      await expect.element(screen.getByRole('status')).toHaveTextContent(ko.labels.validation['range-too-long']);
      expect(rootOf(screen).hasAttribute('data-invalid')).toBe(false);

      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      await expect.poll(() => rootOf(screen).hasAttribute('data-invalid')).toBe(true);
    });
  });

  describe('confirm mode', () => {
    it('keeps the committed range until commit', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root commitMode="confirm" onValueChange={onValueChange}>
          <Calendar.Layout />
          <ConfirmButton />
        </RangeCalendar.Root>,
      );

      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: ko.labels.confirm }).click();
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
    });

    it('reports the confirmed range even when the calendar closes in the same click', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <ClosableRangeCalendar commitMode="confirm" onValueChange={onValueChange} />,
      );

      await tapDay(screen, '2026-10-13');
      await tapDay(screen, '2026-10-17');
      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      await expect.element(screen.getByText('Closed')).toBeVisible();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-13', end: '2026-10-17' }, { validity: VALID });
    });

    it('selects a preset range through setRange', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root commitMode="confirm">
          <Calendar.Layout />
          <PresetButton />
        </RangeCalendar.Root>,
      );

      await screen.getByRole('button', { name: 'preset' }).click();

      await expect.poll(() => screen.container.querySelectorAll(IN_RANGE_SELECTOR).length).toBe(7);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations in Korean with a selected range apart from the accepted label-in-name exception', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      // Constraint: 칸 이름 "20일"을 axe가 한 낱말로 보는 ko 예외는 M4 ledger 판정(T2)을 따름. en·ja는 아래에서 이 규칙까지 검사함
      await expectNoAxeViolations(screen.container, { disabledRules: ['label-content-name-mismatch'] });
    });

    it.each([
      ['en', en],
      ['ja', ja],
    ])('has no axe violations in %s with a selected range and every rule enabled', async (_localeId, locale) => {
      const screen = await render(
        <LunisolarProvider locale={locale} timeZone="Asia/Seoul" today={FIXED_TODAY}>
          <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />
        </LunisolarProvider>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      await expectNoAxeViolations(screen.container);
    });
  });

  describe('disabled', () => {
    it('leaves no cell in the tab order', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root disabled defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(screen.container.querySelectorAll('[data-lsp-part="calendar-cell"] > button').length).toBeGreaterThan(0);
      expect(screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR)).toHaveLength(0);
    });

    it('ignores grid keys', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(<RangeCalendar.Root disabled onValueChange={onValueChange} />);

      // Constraint: 비활성 칸은 탭 정지점도 클릭 포커스도 기대할 수 없어 직접 포커스한 뒤 키를 보냄
      await tapDay(screen, '2026-10-13');
      await userEvent.keyboard('{ArrowRight}{Enter}');
      await settleEffects();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-13') })).toHaveFocus();
      expect(screen.container.querySelectorAll(IN_RANGE_SELECTOR)).toHaveLength(0);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('read-only', () => {
    it('navigates but keeps the range', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root
          readOnly
          defaultValue={{ start: '2026-10-13', end: '2026-10-17' }}
          onValueChange={onValueChange}
        />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();
      expect(screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR)).toHaveLength(1);

      await tapDay(screen, '2026-10-20');
      await tapDay(screen, '2026-10-22');
      await settleEffects();
      expect(screen.container.querySelectorAll(IN_RANGE_SELECTOR)).toHaveLength(5);
      expect(onValueChange).not.toHaveBeenCalled();

      await userEvent.keyboard('{PageDown}');
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M11'));
    });
  });

  describe('focus leave', () => {
    it('reports blur once when focus leaves the calendar, not while moving between days', async () => {
      const onBlur = vi.fn();
      const screen = await render(
        <KoreanProvider>
          <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} onBlur={onBlur} />
          <input aria-label="outside" />
        </KoreanProvider>,
      );
      await focusDirectly(screen.getByRole('button', { name: dayLabel('2026-10-13') }));

      await userEvent.keyboard('{ArrowRight}');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-14') })).toHaveFocus();
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();

      await clickToFocus(screen.getByRole('textbox', { name: 'outside' }));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('form participation', () => {
    it('submits both ends through hidden inputs when named', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root startName="from" endName="to" defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(hiddenInputOf(screen.container, 'from').value).toBe('2026-10-13');
      expect(hiddenInputOf(screen.container, 'to').value).toBe('2026-10-17');
    });

    it('blocks form submission while required and empty', async () => {
      const screen = await renderRangeCalendar(
        <form aria-label="stay">
          <RangeCalendar.Root startName="from" endName="to" required />
        </form>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(hiddenInputOf(screen.container, 'from').checkValidity()).toBe(false);
      expect(hiddenInputOf(screen.container, 'to').checkValidity()).toBe(false);
    });

    it('moves focus from a hidden input to the tabbable day', async () => {
      const screen = await renderRangeCalendar(
        <RangeCalendar.Root startName="from" endName="to" defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      hiddenInputOf(screen.container, 'to').focus();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-13') })).toHaveFocus();
    });

    it('returns an uncontrolled range to the default given at mount on form reset', async () => {
      const onValueChange = vi.fn();
      const calendarIn = (defaultStart: string): ReactElement => (
        <KoreanProvider>
          <form aria-label="stay">
            <RangeCalendar.Root
              startName="from"
              endName="to"
              defaultValue={{ start: defaultStart, end: '2026-10-17' }}
              onValueChange={onValueChange}
            />
          </form>
        </KoreanProvider>
      );
      const screen = await render(calendarIn('2026-10-13'));
      await screen.rerender(calendarIn('2026-10-15'));
      await tapDay(screen, '2026-10-20');
      await tapDay(screen, '2026-10-22');
      await expect.poll(() => hiddenInputOf(screen.container, 'from').value).toBe('2026-10-20');

      formElementOf(screen.getByRole('form')).reset();

      await expect.poll(() => hiddenInputOf(screen.container, 'from').value).toBe('2026-10-13');
      expect(hiddenInputOf(screen.container, 'to').value).toBe('2026-10-17');
      await expect
        .poll(() => onValueChange.mock.calls.map(([value]) => value))
        .toEqual([
          { start: '2026-10-20', end: '2026-10-22' },
          { start: '2026-10-13', end: '2026-10-17' },
        ]);
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderRangeCalendar(
        <form aria-label="stay">
          <RangeCalendar.Root
            startName="from"
            endName="to"
            value={{ start: '2026-10-20', end: '2026-10-22' }}
            defaultValue={{ start: '2026-10-13', end: '2026-10-17' }}
            onValueChange={onValueChange}
          />
        </form>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      formElementOf(screen.getByRole('form')).reset();
      await settleEffects();

      expect(hiddenInputOf(screen.container, 'from').value).toBe('2026-10-20');
      expect(hiddenInputOf(screen.container, 'to').value).toBe('2026-10-22');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
