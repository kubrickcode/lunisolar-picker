import type { ColumnOption } from '@lunisolar-picker/core';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { settleEffects } from '../testing/settle-effects';
import * as Wheel from './parts';
import { WHEEL_POSITION_PROPERTY } from './use-wheel-motion';

type WheelProbeProps = {
  readonly initialValue: number;
  readonly label: string;
  readonly onValueChange: (value: number) => void;
  readonly options: readonly ColumnOption<number>[];
};

const years = Array.from({ length: 9999 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
  isDisabled: false,
}));
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}월`,
  isDisabled: index === 1,
}));
const blockedDays = [1, 2, 3].map((day) => ({ value: day, label: String(day), isDisabled: true }));

const WheelProbe = ({ initialValue, label, onValueChange, options }: WheelProbeProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <Wheel.Root aria-label={label}>
      <Wheel.Highlight />
      <Wheel.Column
        label={label}
        options={options}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    </Wheel.Root>
  );
};

const YearWheel = ({ onValueChange }: { readonly onValueChange: (value: number) => void }) => (
  <WheelProbe label="Year" options={years} initialValue={1990} onValueChange={onValueChange} />
);

const MonthWheel = ({ onValueChange }: { readonly onValueChange: (value: number) => void }) => (
  <WheelProbe label="Month" options={months} initialValue={1} onValueChange={onValueChange} />
);

const firstItemHeight = (): number => {
  const item = document.querySelector('[data-lsp-part="wheel-item"]');
  if (!(item instanceof HTMLElement)) throw new Error('wheel item is not rendered');
  return item.getBoundingClientRect().height;
};

describe('Wheel', () => {
  it('exposes the column as a spinbutton with readable value text', async () => {
    const screen = await render(<MonthWheel onValueChange={vi.fn()} />);

    await expect.element(screen.getByRole('spinbutton', { name: 'Month' })).toHaveAttribute('aria-valuetext', '1월');
    await expectNoAxeViolations(screen.container);
  });

  describe('keyboard', () => {
    it('steps with arrow keys and skips disabled options', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<MonthWheel onValueChange={onValueChange} />);
      const column = screen.getByRole('spinbutton', { name: 'Month' });
      column.element().focus();
      await expect.element(column).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(3);
    });

    it('jumps to the last option with End', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<MonthWheel onValueChange={onValueChange} />);
      const column = screen.getByRole('spinbutton', { name: 'Month' });
      column.element().focus();
      await expect.element(column).toHaveFocus();

      await userEvent.keyboard('{End}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(12);
    });

    it('moves by five options with PageDown', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<YearWheel onValueChange={onValueChange} />);
      const column = screen.getByRole('spinbutton', { name: 'Year' });
      column.element().focus();
      await expect.element(column).toHaveFocus();

      await userEvent.keyboard('{PageDown}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(1995);
    });

    it('never reports a disabled option when every option is disabled', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelProbe label="Day" options={blockedDays} initialValue={1} onValueChange={onValueChange} />,
      );
      const column = screen.getByRole('spinbutton', { name: 'Day' });
      column.element().focus();
      await expect.element(column).toHaveFocus();

      await userEvent.keyboard('{End}');

      await expect.poll(() => column.element().style.getPropertyValue(WHEEL_POSITION_PROPERTY)).toBe('2');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
    });
  });

  describe('pointer', () => {
    it('moves by whole items after a mouse wheel scroll settles', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<YearWheel onValueChange={onValueChange} />);
      const column = screen.getByRole('spinbutton', { name: 'Year' });

      await userEvent.wheel(column, { delta: { y: firstItemHeight() * 3 } });

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0], { timeout: 2000 }).toBe(1993);
    });

    it('selects a later year after dragging the column upward', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<YearWheel onValueChange={onValueChange} />);

      await userEvent.dragAndDrop(screen.getByText('1992'), screen.getByText('1989'));

      // Goal: 1992는 끌지 않고 누른 항목을 탭으로 고른 결과. 세 칸 끌어 올리면 관성 없이도 1993 이상이 됨
      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0], { timeout: 3000 }).toBeGreaterThan(1992);
    });

    it('selects the item that is tapped without dragging', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<YearWheel onValueChange={onValueChange} />);

      await screen.getByText('1993').click();

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(1993);
    });
  });

  it('keeps the DOM small for long columns by rendering a window of items', async () => {
    await render(<YearWheel onValueChange={vi.fn()} />);

    expect(document.querySelectorAll('[data-lsp-part="wheel-item"]').length).toBeLessThan(100);
  });
});
