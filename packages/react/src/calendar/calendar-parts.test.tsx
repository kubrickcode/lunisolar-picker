import { VALID } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { ja } from '@lunisolar-picker/core/locales/ja';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { focusInitialElement } from '../focus/focusable-elements';
import { LunisolarProvider } from '../settings/lunisolar-provider';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { Calendar } from './index';

const TABBABLE_CELL_SELECTOR = '[data-lsp-part="calendar-cell"] > button[tabindex="0"]';

const renderCalendar = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

const monthName = (year: number, monthCode: 'M09' | 'M10' | 'M11' | 'M12'): string =>
  ko.formatHeading({ year, monthCode }, 'gregory');

const hiddenInputOf = (container: HTMLElement, name: string): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`hidden input ${name} is missing`);
  return input;
};

describe('Calendar', () => {
  describe('grid semantics', () => {
    it('exposes a labelled grid with selected, current and disabled cells', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" isDateDisabled={(date) => date === '2026-10-21'} />,
      );

      const grid = screen.getByRole('grid');
      await expect.element(grid).toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'true');
      await expect
        .element(screen.getByRole('button', { name: dayLabel('2026-10-14') }))
        .toHaveAttribute('aria-current', 'date');
      await expect
        .element(screen.getByRole('button', { name: dayLabel('2026-10-21') }))
        .toHaveAttribute('aria-disabled', 'true');
    });

    it('keeps exactly one tabbable cell when two months share an outside day', async () => {
      // Constraint: 12월 격자는 11월 29·30일을 바깥 날짜로 앞에 둠. 11월 30일이 두 격자에 모두 나오는 경우 (preflight 2.13)
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-11-30" numberOfMonths={2} />);
      await expect.element(screen.getByRole('grid').first()).toBeVisible();

      const tabbable = screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR);
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.getAttribute('aria-label')).toBe(dayLabel('2026-11-30'));
      expect(screen.getByRole('grid').all()).toHaveLength(2);
    });

    it('has no axe violations in Korean apart from the accepted label-in-name exception', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      // Constraint: axe의 Intl.Segmenter는 칸 이름 "2026년 10월 20일 화요일"의 "20일"을 한 낱말로 보아 보이는 "20"과 맞지 않다고 봄(WCAG 2.5.3). M4 ledger 판정으로 받아들이고 M5 Voice Control QA에서 확인함. 후보 해법은 core ko 로케일의 "20 일" 띄어쓰기. en·ja는 아래에서 이 규칙까지 검사함
      await expectNoAxeViolations(screen.container, { disabledRules: ['label-content-name-mismatch'] });
    });

    it.each([
      ['en', en],
      ['ja', ja],
    ])('has no axe violations in %s with every rule enabled', async (_localeId, locale) => {
      const screen = await render(
        <LunisolarProvider locale={locale} timeZone="Asia/Seoul" today={FIXED_TODAY}>
          <Calendar.Root defaultValue="2026-10-20" />
        </LunisolarProvider>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      await expectNoAxeViolations(screen.container);
    });

    it('names a second month grid by its own heading', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" numberOfMonths={2} />);

      await expect.element(screen.getByRole('grid').nth(1)).toHaveAccessibleName(monthName(2026, 'M11'));
    });

    it('abbreviates weekday headers and keeps the full name in abbr', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);

      const sundayHeader = screen.getByRole('columnheader').first();
      await expect.element(sundayHeader).toHaveTextContent(ko.weekdays.narrow[0] ?? '');
      await expect.element(sundayHeader).toHaveAttribute('abbr', ko.weekdays.long[0] ?? '');
    });
  });

  describe('keyboard', () => {
    it.each([
      ['{ArrowRight}', '2026-10-21'],
      ['{ArrowLeft}', '2026-10-19'],
      ['{ArrowDown}', '2026-10-27'],
      ['{ArrowUp}', '2026-10-13'],
      ['{Home}', '2026-10-18'],
      ['{End}', '2026-10-24'],
      ['{PageDown}', '2026-11-20'],
      ['{PageUp}', '2026-09-20'],
      ['{Shift>}{PageDown}{/Shift}', '2027-10-20'],
      ['{Shift>}{PageUp}{/Shift}', '2025-10-20'],
    ])('moves focus with %s to %s', async (keys, expectedDate) => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      await clickToFocus(screen.getByRole('button', { name: dayLabel('2026-10-20') }));

      await userEvent.keyboard(keys);

      await expect.element(screen.getByRole('button', { name: dayLabel(expectedDate) })).toHaveFocus();
    });

    it('selects the focused day with Enter and Space', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" onValueChange={onValueChange} />);
      await clickToFocus(screen.getByRole('button', { name: dayLabel('2026-10-20') }));

      await userEvent.keyboard('{ArrowRight}{Enter}');
      await userEvent.keyboard('{ArrowRight}[Space]');

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-22') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-21', '2026-10-22']);
    });
  });

  describe('outside days', () => {
    it('keeps focus on the clicked outside day when its month comes into view', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      await focusOnce(screen.getByRole('button', { name: dayLabel('2026-10-20') }));

      await screen.getByRole('button', { name: dayLabel('2026-09-30') }).click();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M09'));
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-09-30') })).toHaveFocus();
    });
  });

  describe('keyboard focus request', () => {
    it('leaves no focus request behind an arrow key blocked at the max bound', async () => {
      // Constraint: 다시 그리기가 실제로 칸까지 내려가도록 렌더마다 새 요소를 만듦. 같은 요소면 React가 건너뜀
      const calendarTree = (): ReactElement => (
        <KoreanProvider>
          <Calendar.Root max={FIXED_TODAY} />
          <input aria-label="outside" />
        </KoreanProvider>
      );
      const screen = await render(calendarTree());
      const lastDay = screen.getByRole('button', { name: dayLabel(FIXED_TODAY) });
      await focusOnce(lastDay);
      await userEvent.keyboard('{ArrowRight}');
      await expect.element(lastDay).toHaveFocus();

      const outside = screen.getByRole('textbox', { name: 'outside' });
      await focusOnce(outside);
      await screen.rerender(calendarTree());
      await settleEffects();

      await expect.element(outside).toHaveFocus();
    });
  });

  describe('opening focus', () => {
    it('lands on the selected day', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      focusInitialElement(screen.container);

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-20') })).toHaveFocus();
    });

    it('lands on today when nothing is selected', async () => {
      const screen = await renderCalendar(<Calendar.Root />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      focusInitialElement(screen.container);

      await expect.element(screen.getByRole('button', { name: dayLabel(FIXED_TODAY) })).toHaveFocus();
    });
  });

  describe('navigation buttons', () => {
    it('moves between months and back to today', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await expect
        .element(screen.getByRole('grid'))
        .toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory'));

      await screen.getByRole('button', { name: ko.labels.today }).click();
      await expect
        .element(screen.getByRole('grid'))
        .toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
    });

    it('disables the next button at the end of the supported range', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="9999-12-15" />);
      const nextButton = screen.getByRole('button', { name: ko.labels.nextMonth });
      await expect.element(nextButton).toHaveAttribute('aria-disabled', 'true');
      await expect
        .element(screen.getByRole('button', { name: ko.labels.previousMonth }))
        .not.toHaveAttribute('aria-disabled');

      // Constraint: Playwright는 aria-disabled 요소를 클릭하지 않으므로 강제로 눌러 버튼이 아무 일도 하지 않는지 확인함
      await nextButton.click({ force: true });
      await settleEffects();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(9999, 'M12'));
    });

    it('marks the month body with the slide direction', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      const monthBody = () => screen.container.querySelector('[data-lsp-part="calendar-grid"] > tbody');
      await expect.element(screen.getByRole('grid')).toBeVisible();
      expect(monthBody()?.hasAttribute('data-slide')).toBe(false);

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await expect.poll(() => monthBody()?.getAttribute('data-slide')).toBe('next');

      await screen.getByRole('button', { name: ko.labels.previousMonth }).click();
      await expect.poll(() => monthBody()?.getAttribute('data-slide')).toBe('previous');
    });

    it('runs an app click handler before navigating', async () => {
      const onClick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20">
          <Calendar.Heading />
          <Calendar.NextButton onClick={onClick} />
          <Calendar.Grid />
        </Calendar.Root>,
      );

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M11'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('marks the today button disabled while today is visible', async () => {
      const screen = await renderCalendar(<Calendar.Root />);

      await expect
        .element(screen.getByRole('button', { name: ko.labels.today }))
        .toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('cell customization', () => {
    it('renders app content in a cell and appends the app label to its name', async () => {
      const holidays: Record<string, string> = { '2026-10-09': '한글날' };
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" getCellLabel={(cell) => holidays[cell.date]}>
          <Calendar.Grid>
            {(cell) => (
              <Calendar.Cell key={cell.epochDay} cell={cell}>
                {(info) => (
                  <>
                    {info.day}
                    {holidays[info.date] ? <i data-testid="holiday-dot" /> : null}
                  </>
                )}
              </Calendar.Cell>
            )}
          </Calendar.Grid>
        </Calendar.Root>,
      );

      await expect.element(screen.getByRole('button', { name: `${dayLabel('2026-10-09')}, 한글날` })).toBeVisible();
      expect(screen.getByTestId('holiday-dot').all()).toHaveLength(1);
    });

    it('lets an app click handler cancel the selection', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" onValueChange={onValueChange}>
          <Calendar.Grid>
            {(cell) => <Calendar.Cell key={cell.epochDay} cell={cell} onClick={(event) => event.preventDefault()} />}
          </Calendar.Grid>
        </Calendar.Root>,
      );

      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click();
      await settleEffects();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('reserved props', () => {
    it('keeps a single roving tab stop when the app passes tabIndex to every cell', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20">
          <Calendar.Grid>{(cell) => <Calendar.Cell key={cell.epochDay} cell={cell} tabIndex={0} />}</Calendar.Grid>
        </Calendar.Root>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      const tabbable = screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR);
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.getAttribute('aria-label')).toBe(dayLabel('2026-10-20'));
    });

    it('keeps a cell focusable when the app passes a native disabled', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20">
          <Calendar.Grid>{(cell) => <Calendar.Cell key={cell.epochDay} cell={cell} disabled />}</Calendar.Grid>
        </Calendar.Root>,
      );
      const selectedDay = screen.getByRole('button', { name: dayLabel('2026-10-20') });
      await expect.element(selectedDay).toBeVisible();

      expect(selectedDay.element().hasAttribute('disabled')).toBe(false);
      selectedDay.element().focus();
      await expect.element(selectedDay).toHaveFocus();
    });

    it('keeps the grid named when the app gives the heading its own id', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20">
          <Calendar.Heading id="app-heading" />
          <Calendar.Grid />
        </Calendar.Root>,
      );

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M10'));
    });
  });

  describe('layout', () => {
    it('renders app cell content through renderCell', async () => {
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20">
          <Calendar.Layout renderCell={(info) => <span data-testid="app-day">{info.day}</span>} />
        </Calendar.Root>,
      );
      await expect.element(screen.getByRole('button', { name: ko.labels.nextMonth })).toBeVisible();

      expect(screen.getByTestId('app-day').all()).toHaveLength(screen.getByRole('gridcell').all().length);
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-20') })).toHaveTextContent('20');
    });
  });

  describe('disabled', () => {
    it('makes navigation buttons inert', async () => {
      const screen = await renderCalendar(<Calendar.Root disabled defaultValue="2026-11-20" />);
      const nextButton = screen.getByRole('button', { name: ko.labels.nextMonth });
      await expect.element(nextButton).toHaveAttribute('aria-disabled', 'true');
      await expect.element(nextButton).toHaveAttribute('data-disabled', '');
      await expect
        .element(screen.getByRole('button', { name: ko.labels.previousMonth }))
        .toHaveAttribute('aria-disabled', 'true');
      await expect
        .element(screen.getByRole('button', { name: ko.labels.today }))
        .toHaveAttribute('aria-disabled', 'true');

      await nextButton.click({ force: true });
      await screen.getByRole('button', { name: ko.labels.today }).click({ force: true });
      await settleEffects();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M11'));
    });

    it('leaves no cell in the tab order', async () => {
      const screen = await renderCalendar(<Calendar.Root disabled defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(screen.container.querySelectorAll('[data-lsp-part="calendar-cell"] > button').length).toBeGreaterThan(0);
      expect(screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR)).toHaveLength(0);
    });

    it('ignores grid keys', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root disabled defaultValue="2026-10-20" onValueChange={onValueChange} onPick={onPick} />,
      );
      // Constraint: 비활성 칸은 탭 정지점도 클릭 포커스도 기대할 수 없어 직접 포커스한 뒤 키를 보냄
      const day = screen.getByRole('button', { name: dayLabel('2026-10-20') });
      day.element().focus();
      await expect.element(day).toHaveFocus();

      await userEvent.keyboard('{ArrowRight}{PageDown}{Enter}');
      await settleEffects();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-20') })).toHaveFocus();
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M10'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onPick).not.toHaveBeenCalled();
    });
  });

  describe('read-only', () => {
    it('navigates but keeps the selection', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root readOnly defaultValue="2026-10-20" onValueChange={onValueChange} onPick={onPick} />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();
      expect(screen.container.querySelectorAll(TABBABLE_CELL_SELECTOR)).toHaveLength(1);

      // Constraint: 읽기 전용 칸은 aria-disabled라 Playwright가 클릭하지 않으므로 강제로 누름
      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click({ force: true });
      await settleEffects();
      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onPick).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(2026, 'M11'));
    });
  });

  describe('picks', () => {
    it('reports a re-pick of the selected day through onPick without a value change', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" onValueChange={onValueChange} onPick={onPick} />,
      );

      await screen.getByRole('button', { name: dayLabel('2026-10-20') }).click();
      await settleEffects();

      expect(onPick.mock.calls).toEqual([['2026-10-20']]);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('reports a day picked in confirm mode before it is committed', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root commitMode="confirm" defaultValue="2026-10-20" onValueChange={onValueChange} onPick={onPick} />,
      );

      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click();
      await settleEffects();

      expect(onPick.mock.calls).toEqual([['2026-10-22']]);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('ignores a day rejected by isDateDisabled', async () => {
      const onPick = vi.fn();
      const screen = await renderCalendar(
        <Calendar.Root defaultValue="2026-10-20" isDateDisabled={(date) => date === '2026-10-22'} onPick={onPick} />,
      );

      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click({ force: true });
      await settleEffects();
      expect(onPick).not.toHaveBeenCalled();
      // Goal: 클릭은 칸에서 먼저 막히므로 키보드 선택으로 훅의 제약 검사까지 거치게 함
      await clickToFocus(screen.getByRole('button', { name: dayLabel('2026-10-21') }));
      onPick.mockClear();
      await userEvent.keyboard('{ArrowRight}');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-22') })).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await settleEffects();

      expect(onPick).not.toHaveBeenCalled();
    });
  });

  describe('focus leave', () => {
    it('reports blur once when focus leaves the calendar, not while moving between days', async () => {
      const onBlur = vi.fn();
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-20" onBlur={onBlur} />
          <input aria-label="outside" />
        </KoreanProvider>,
      );
      await clickToFocus(screen.getByRole('button', { name: dayLabel('2026-10-20') }));

      await userEvent.keyboard('{ArrowRight}');
      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-21') })).toHaveFocus();
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();

      await clickToFocus(screen.getByRole('textbox', { name: 'outside' }));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('form participation', () => {
    it('submits the value through a hidden input when named', async () => {
      const screen = await renderCalendar(<Calendar.Root name="installedOn" defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-20');
    });

    it('blocks form submission while required and empty', async () => {
      const screen = await renderCalendar(
        <form aria-label="install">
          <Calendar.Root name="installedOn" required />
        </form>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(hiddenInputOf(screen.container, 'installedOn').checkValidity()).toBe(false);
    });

    it('moves focus from the hidden input to the tabbable day', async () => {
      const screen = await renderCalendar(<Calendar.Root name="installedOn" defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      hiddenInputOf(screen.container, 'installedOn').focus();

      await expect.element(screen.getByRole('button', { name: dayLabel('2026-10-20') })).toHaveFocus();
    });

    it('returns an uncontrolled calendar to its default value on form reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(
        <form aria-label="install">
          <Calendar.Root name="installedOn" defaultValue="2026-10-20" onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click();
      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-22') }))
        .toHaveAttribute('aria-selected', 'true');

      formElementOf(screen.getByRole('form')).reset();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-20');
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-22', '2026-10-20']);
    });

    it('reports an emptied required calendar as valid on form reset', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(
        <form aria-label="install">
          <Calendar.Root name="installedOn" required onValueChange={onValueChange} />
        </form>,
      );
      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click();
      await expect.poll(() => hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-22');

      formElementOf(screen.getByRole('form')).reset();

      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([null, { validity: VALID }]);
      expect(hiddenInputOf(screen.container, 'installedOn').checkValidity()).toBe(false);
    });

    it('resets to the default given at mount, not a later defaultValue', async () => {
      const calendarIn = (defaultValue: string): ReactElement => (
        <KoreanProvider>
          <form aria-label="install">
            <Calendar.Root name="installedOn" defaultValue={defaultValue} />
          </form>
        </KoreanProvider>
      );
      const screen = await render(calendarIn('2026-10-20'));
      await screen.rerender(calendarIn('2026-10-25'));
      await screen.getByRole('button', { name: dayLabel('2026-10-22') }).click();
      await expect.poll(() => hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-22');

      formElementOf(screen.getByRole('form')).reset();

      await expect.poll(() => hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-20');
    });

    it('resets to empty when the default value calendar is no longer provided', async () => {
      const calendarIn = (hasLunar: boolean): ReactElement => (
        <KoreanProvider hasLunar={hasLunar}>
          <form aria-label="install">
            <Calendar.Root name="installedOn" defaultValue="2026-10-20[u-ca=dangi]" />
          </form>
        </KoreanProvider>
      );
      const screen = await render(calendarIn(true));
      await screen.rerender(calendarIn(false));
      await expect.poll(() => hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-20');

      formElementOf(screen.getByRole('form')).reset();

      await expect.poll(() => hiddenInputOf(screen.container, 'installedOn').value).toBe('');
    });

    it('ignores form reset while controlled', async () => {
      const onValueChange = vi.fn();
      const screen = await renderCalendar(
        <form aria-label="install">
          <Calendar.Root
            name="installedOn"
            value="2026-10-22"
            defaultValue="2026-10-20"
            onValueChange={onValueChange}
          />
        </form>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      formElementOf(screen.getByRole('form')).reset();
      await settleEffects();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-22') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
