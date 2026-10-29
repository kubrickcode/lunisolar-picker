import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { focusDirectly } from '../testing/focus-directly';
import { settleEffects } from '../testing/settle-effects';
import { type ButtonGridItem, MonthButtonGrid } from './month-button-grid';

const COLUMN_COUNT = 3;
const MONTH_COUNT = 12;
const TAB_STOP_SELECTOR = 'button[tabindex="0"]';

const monthItems = (selectedMonth: number): readonly ButtonGridItem[] =>
  Array.from({ length: MONTH_COUNT }, (_, index) => ({
    key: `M${String(index + 1).padStart(2, '0')}`,
    label: `${index + 1}월`,
    accessibleName: `${index + 1}월`,
    isSelected: index + 1 === selectedMonth,
    isDisabled: false,
    onPick: vi.fn(),
  }));

const yearItems = (firstYear: number, count: number): readonly ButtonGridItem[] =>
  Array.from({ length: count }, (_, index) => ({
    key: String(firstYear + index),
    label: String(firstYear + index),
    accessibleName: String(firstYear + index),
    isSelected: false,
    isDisabled: false,
    onPick: vi.fn(),
  }));

const monthGrid = (items: readonly ButtonGridItem[]): ReactElement => (
  <MonthButtonGrid items={items} columnCount={COLUMN_COUNT} label="월 선택" part="calendar-month-grid" />
);

describe('MonthButtonGrid', () => {
  describe('keyboard', () => {
    it.each([
      ['{ArrowUp}', '5월', '2월'],
      ['{ArrowLeft}', '5월', '4월'],
      ['{Home}', '5월', '1월'],
      ['{End}', '5월', '12월'],
      ['{ArrowUp}', '2월', '2월'],
      ['{ArrowLeft}', '1월', '1월'],
      ['{ArrowDown}', '11월', '11월'],
      ['{ArrowRight}', '12월', '12월'],
    ])('moves focus with %s from %s to %s', async (keys, startName, expectedName) => {
      const screen = await render(monthGrid(monthItems(1)));
      await focusDirectly(screen.getByRole('button', { name: startName }));

      await userEvent.keyboard(keys);
      await settleEffects();

      await expect.element(screen.getByRole('button', { name: expectedName })).toHaveFocus();
      expect(screen.container.querySelector(TAB_STOP_SELECTOR)?.getAttribute('aria-label')).toBe(expectedName);
    });

    it('swaps left and right in right-to-left layouts', async () => {
      const screen = await render(<div dir="rtl">{monthGrid(monthItems(1))}</div>);
      await focusDirectly(screen.getByRole('button', { name: '5월' }));

      await userEvent.keyboard('{ArrowLeft}');

      await expect.element(screen.getByRole('button', { name: '6월' })).toHaveFocus();
    });
  });

  describe('read-only', () => {
    it('announces the grid as read-only and ignores picks', async () => {
      const items = monthItems(3);
      const screen = await render(
        <MonthButtonGrid
          items={items}
          columnCount={COLUMN_COUNT}
          label="월 선택"
          part="calendar-month-grid"
          isReadOnly
        />,
      );
      await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');

      await screen.getByRole('button', { name: '5월' }).click();
      await settleEffects();

      expect(items[4]?.onPick).not.toHaveBeenCalled();
      await expect.element(screen.getByRole('button', { name: '5월' })).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('roving tab stop', () => {
    it('starts on the selected item', async () => {
      const screen = await render(monthGrid(monthItems(7)));
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(Array.from(screen.container.querySelectorAll(TAB_STOP_SELECTOR), (button) => button.textContent)).toEqual([
        '7월',
      ]);
    });

    it('starts on the default focus item when nothing is selected', async () => {
      const screen = await render(
        <MonthButtonGrid
          items={monthItems(0)}
          columnCount={COLUMN_COUNT}
          label="월 선택"
          part="calendar-month-grid"
          defaultFocusKey="M10"
        />,
      );
      await expect.element(screen.getByRole('grid')).toBeVisible();

      expect(Array.from(screen.container.querySelectorAll(TAB_STOP_SELECTOR), (button) => button.textContent)).toEqual([
        '10월',
      ]);
    });

    it('keeps one tab stop when a shorter page drops the focused item', async () => {
      const screen = await render(monthGrid(yearItems(9984, 12)));
      await focusDirectly(screen.getByRole('button', { name: '9995' }));

      await screen.rerender(monthGrid(yearItems(9996, 4)));

      const tabStops = screen.container.querySelectorAll(TAB_STOP_SELECTOR);
      expect(Array.from(tabStops, (button) => button.textContent)).toEqual(['9996']);
    });
  });
});
