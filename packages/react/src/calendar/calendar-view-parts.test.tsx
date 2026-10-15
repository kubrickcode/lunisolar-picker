import type { MonthCode } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { YEAR_PAGE_SIZE } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { LunisolarProvider } from '../settings/lunisolar-provider';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { dayLabel, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { Calendar } from './index';

const OCTOBER_2026 = ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory');

const gregoryMonthName = (year: number, monthCode: MonthCode): string =>
  ko.formatMonthName({ year, monthCode }, 'gregory');

// Goal: 보기 버튼 이름은 보이는 제목 뒤에 동작 이름이 붙음 (WCAG 2.5.3 label in name)
const viewButtonName = (visibleText: string, action: string = ko.labels.chooseMonth): string =>
  `${visibleText} ${action}`;

// Goal: 누르면 동작하는 버튼(월·연 고르기)이나 비활성 버튼에 클릭 없이 포커스를 둔 뒤 자리 잡았는지 확인함
const focusDirectly = async (locator: Locator): Promise<void> => {
  const element = locator.element();
  if (element instanceof HTMLElement) element.focus();
  await expect.element(locator).toHaveFocus();
};

describe('Calendar views', () => {
  describe('lunar toggle', () => {
    it('shows the toggle only when a second calendar is provided', async () => {
      const solarOnly = await render(
        <KoreanProvider>
          <Calendar.Root />
        </KoreanProvider>,
      );
      await expect.element(solarOnly.getByRole('grid')).toBeVisible();
      expect(solarOnly.container.querySelector('[data-lsp-part="calendar-toggle"]')).toBeNull();

      const withLunar = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root />
        </KoreanProvider>,
      );
      await expect.element(withLunar.getByRole('button', { name: ko.calendarNames.dangi })).toBeVisible();
    });

    it('keeps the selected and focused day and emits nothing when switching calendars', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2026-10-14" onValueChange={onValueChange} />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: ko.calendarNames.dangi }).click();

      const lunarHeading = ko.formatHeading({ year: 2026, monthCode: 'M09' }, 'dangi');
      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(lunarHeading);
      const selected = screen.container.querySelector('[data-lsp-part="calendar-cell"][data-selected] > button');
      expect(selected?.getAttribute('aria-label')).toContain(dayLabel('2026-10-14', dangi));
      expect(selected?.getAttribute('tabindex')).toBe('0');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('marks the shown calendar pressed for assistive technology and themes, and reports the switch', async () => {
      const onDisplayCalendarChange = vi.fn();
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2026-10-14" onDisplayCalendarChange={onDisplayCalendarChange} />
        </KoreanProvider>,
      );
      const solarButton = screen.getByRole('button', { name: ko.calendarNames.gregory });
      const lunarButton = screen.getByRole('button', { name: ko.calendarNames.dangi });
      await expect.element(solarButton).toHaveAttribute('aria-pressed', 'true');
      await expect.element(solarButton).toHaveAttribute('data-selected', '');
      await expect.element(lunarButton).toHaveAttribute('aria-pressed', 'false');

      await lunarButton.click();

      await expect.element(lunarButton).toHaveAttribute('aria-pressed', 'true');
      await expect.element(lunarButton).toHaveAttribute('data-selected', '');
      expect(solarButton.element().hasAttribute('data-selected')).toBe(false);
      expect(onDisplayCalendarChange.mock.calls).toEqual([['dangi']]);
    });

    it('prints the secondary date under each in-month day', async () => {
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      const secondaryLabels = screen.container.querySelectorAll('[data-lsp-part="calendar-cell-secondary"]');
      expect(secondaryLabels.length).toBeGreaterThanOrEqual(31);
    });
  });

  describe('month and year views', () => {
    it('drills from days to months to years and back to days', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();

      await screen.getByRole('button', { name: viewButtonName('2026') }).click();
      // Constraint: 연 격자는 2026이 든 쪽(2016–2027)에서 열리므로 다음 쪽으로 넘겨야 2031이 보임 (preflight 2.6)
      await screen.getByRole('button', { name: ko.labels.nextYears }).click();
      await screen.getByRole('button', { name: '2031' }).click();
      await screen.getByRole('button', { name: gregoryMonthName(2031, 'M03') }).click();

      await expect
        .element(screen.getByRole('grid'))
        .toHaveAccessibleName(ko.formatHeading({ year: 2031, monthCode: 'M03' }, 'gregory'));
    });

    it('lists the leap month in the lunar month view', async () => {
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root defaultValue="2025-08-01" defaultDisplayCalendar="dangi" />
        </KoreanProvider>,
      );

      await screen
        .getByRole('button', { name: viewButtonName(ko.formatHeading({ year: 2025, monthCode: 'M06L' }, 'dangi')) })
        .click();

      await expect
        .element(screen.getByRole('button', { name: ko.formatMonthName({ year: 2025, monthCode: 'M06L' }, 'dangi') }))
        .toBeVisible();
    });

    it('moves focus between month buttons with arrow keys', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      // Constraint: 월 버튼을 누르면 그 달을 고르므로 클릭 대신 직접 포커스함
      await focusDirectly(screen.getByRole('button', { name: gregoryMonthName(2026, 'M07') }));

      await userEvent.keyboard('{ArrowDown}{ArrowRight}');

      expect(document.activeElement?.getAttribute('aria-label')).toBe(gregoryMonthName(2026, 'M11'));
    });

    it('keeps one month button in the tab order and marks it for opening focus', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();

      const tabbable = screen.container.querySelectorAll('[data-lsp-part="calendar-month-grid"] button[tabindex="0"]');
      expect(Array.from(tabbable, (button) => button.getAttribute('aria-label'))).toEqual([
        gregoryMonthName(2026, 'M10'),
      ]);
      expect(tabbable[0]?.hasAttribute('data-autofocus')).toBe(true);
      await expect
        .element(screen.getByRole('gridcell', { name: gregoryMonthName(2026, 'M10') }))
        .toHaveAttribute('aria-selected', 'true');
    });

    it('keeps keyboard focus inside the calendar while drilling back down to days', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      await screen.getByRole('button', { name: viewButtonName('2026') }).click();
      await focusDirectly(screen.getByRole('button', { name: '2026' }));

      await userEvent.keyboard('{ArrowRight}{Enter}');
      await expect.element(screen.getByRole('button', { name: gregoryMonthName(2027, 'M10') })).toHaveFocus();

      await userEvent.keyboard('{ArrowRight}{Enter}');
      await expect.element(screen.getByRole('button', { name: dayLabel('2027-11-14') })).toHaveFocus();
    });

    it('names the view button by its visible text and the locale action, with the year span in the years view', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      await screen.getByRole('button', { name: viewButtonName('2026') }).click();

      const yearSpan = `2016${ko.rangeSeparator}${2016 + YEAR_PAGE_SIZE - 1}`;
      await expect
        .element(screen.getByRole('button', { name: viewButtonName(yearSpan, ko.labels.year) }))
        .toBeVisible();
      await expect.element(screen.getByRole('grid', { name: ko.labels.year })).toBeVisible();
    });

    it('moves a year at a time with the navigation buttons in the months view', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();

      await screen.getByRole('button', { name: ko.labels.nextYears }).click();

      await expect.element(screen.getByRole('button', { name: viewButtonName('2027') })).toBeVisible();
    });

    it('disables months and years outside min and max', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" min="2026-03-15" max="2026-11-02" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();

      const monthButton = (monthCode: MonthCode) =>
        screen.getByRole('button', { name: gregoryMonthName(2026, monthCode) });
      await expect.element(monthButton('M12')).toHaveAttribute('aria-disabled', 'true');
      await expect.element(monthButton('M11')).not.toHaveAttribute('aria-disabled');
      await expect.element(monthButton('M03')).not.toHaveAttribute('aria-disabled');
      await expect
        .element(screen.getByRole('gridcell', { name: gregoryMonthName(2026, 'M12') }))
        .toHaveAttribute('data-disabled', '');

      await screen.getByRole('button', { name: viewButtonName('2026') }).click();
      await expect.element(screen.getByRole('button', { name: '2027' })).toHaveAttribute('aria-disabled', 'true');
      await expect.element(screen.getByRole('button', { name: '2026' })).not.toHaveAttribute('aria-disabled');
    });

    it('ignores a pick on a disabled month', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" max="2026-11-02" />
        </KoreanProvider>,
      );
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();

      await screen.getByRole('button', { name: gregoryMonthName(2026, 'M12') }).click({ force: true });
      await settleEffects();

      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();
    });

    it('has no axe violations in the month and year views with every rule enabled', async () => {
      const screen = await render(
        <LunisolarProvider locale={en} timeZone="Asia/Seoul" today={FIXED_TODAY} calendars={[dangi]}>
          <Calendar.Root defaultValue="2026-10-14" />
        </LunisolarProvider>,
      );
      await screen
        .getByRole('button', {
          name: `${en.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory')} ${en.labels.chooseMonth}`,
        })
        .click();
      await expect.element(screen.getByRole('grid', { name: en.labels.chooseMonth })).toBeVisible();
      await expectNoAxeViolations(screen.container);

      await screen.getByRole('button', { name: `2026 ${en.labels.chooseMonth}` }).click();
      await expect.element(screen.getByRole('grid', { name: en.labels.year })).toBeVisible();
      await expectNoAxeViolations(screen.container);
    });
  });

  describe('disabled', () => {
    it('makes the view button and the calendar toggle inert', async () => {
      const onDisplayCalendarChange = vi.fn();
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root disabled defaultValue="2026-10-14" onDisplayCalendarChange={onDisplayCalendarChange} />
        </KoreanProvider>,
      );
      const viewButton = screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) });
      const lunarButton = screen.getByRole('button', { name: ko.calendarNames.dangi });
      await expect.element(viewButton).toHaveAttribute('aria-disabled', 'true');
      await expect.element(viewButton).toHaveAttribute('data-disabled', '');
      await expect.element(lunarButton).toHaveAttribute('aria-disabled', 'true');
      await expect.element(lunarButton).toHaveAttribute('data-disabled', '');

      await viewButton.click({ force: true });
      await lunarButton.click({ force: true });
      await settleEffects();

      await expect
        .element(screen.getByRole('grid'))
        .toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory'));
      expect(onDisplayCalendarChange).not.toHaveBeenCalled();
    });

    it('takes the month grid out of the tab order and ignores picks and keys once disabled', async () => {
      const calendarIn = (isDisabled: boolean) => (
        <KoreanProvider>
          <Calendar.Root disabled={isDisabled} defaultValue="2026-10-14" />
        </KoreanProvider>
      );
      const screen = await render(calendarIn(false));
      await screen.getByRole('button', { name: viewButtonName(OCTOBER_2026) }).click();
      await screen.rerender(calendarIn(true));

      const julyButton = screen.getByRole('button', { name: gregoryMonthName(2026, 'M07') });
      await expect.element(julyButton).toHaveAttribute('aria-disabled', 'true');
      expect(
        screen.container.querySelectorAll('[data-lsp-part="calendar-month-grid"] button[tabindex="0"]'),
      ).toHaveLength(0);
      await focusDirectly(julyButton);
      await userEvent.keyboard('{ArrowRight}');
      await settleEffects();
      await expect.element(julyButton).toHaveFocus();

      await julyButton.click({ force: true });
      await settleEffects();
      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();
    });
  });

  describe('read-only', () => {
    it('still switches calendars and views', async () => {
      const screen = await render(
        <KoreanProvider hasLunar>
          <Calendar.Root readOnly defaultValue="2026-10-14" />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: ko.calendarNames.dangi }).click();
      await expect
        .element(screen.getByRole('grid'))
        .toHaveAccessibleName(ko.formatHeading({ year: 2026, monthCode: 'M09' }, 'dangi'));

      await screen
        .getByRole('button', { name: viewButtonName(ko.formatHeading({ year: 2026, monthCode: 'M09' }, 'dangi')) })
        .click();
      await expect.element(screen.getByRole('grid', { name: ko.labels.chooseMonth })).toBeVisible();
    });
  });

  describe('month transition', () => {
    it('marks the grid body with the slide direction after moving forward', async () => {
      const screen = await render(
        <KoreanProvider>
          <Calendar.Root defaultValue="2026-10-14" />
        </KoreanProvider>,
      );

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();

      await expect.poll(() => screen.container.querySelector('tbody')?.getAttribute('data-slide')).toBe('next');
    });
  });
});
