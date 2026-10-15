import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { focusInitialElement } from '../focus/focusable-elements';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { Calendar } from './index';

const renderCalendar = (element: ReactElement) => render(<KoreanProvider>{element}</KoreanProvider>);

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

      const tabbable = screen.container.querySelectorAll('[data-lsp-part="calendar-cell"] > button[tabindex="0"]');
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]?.getAttribute('aria-label')).toBe(dayLabel('2026-11-30'));
      expect(screen.getByRole('grid').all()).toHaveLength(2);
    });

    it('has no axe violations', async () => {
      const screen = await renderCalendar(<Calendar.Root defaultValue="2026-10-20" />);
      await expect.element(screen.getByRole('grid')).toBeVisible();

      // Constraint: 한국어 칸 이름 "2026년 10월 20일 화요일"에서 axe는 "20일"을 한 낱말로 보아 보이는 "20"과 맞지 않다고 봄(WCAG 2.5.3). en·ja는 통과함. 칸 이름 형식은 스펙 10.1과 core ko 로케일이 정하므로 여기서는 이 규칙만 끔
      await expectNoAxeViolations(screen.container, { disabledRules: ['label-content-name-mismatch'] });
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

      hiddenInputOf(screen.container, 'installedOn').form?.reset();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(hiddenInputOf(screen.container, 'installedOn').value).toBe('2026-10-20');
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['2026-10-22', '2026-10-20']);
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

      hiddenInputOf(screen.container, 'installedOn').form?.reset();
      await settleEffects();

      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-22') }))
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
