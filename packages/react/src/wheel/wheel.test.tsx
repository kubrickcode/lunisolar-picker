import type { ColumnOption } from '@lunisolar-picker/core';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { dispatchMousePointer } from '../testing/dispatch-mouse-pointer';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { settleEffects } from '../testing/settle-effects';
import * as Wheel from './parts';
import { useWheel } from './use-wheel';
import { WHEEL_POSITION_PROPERTY } from './use-wheel-motion';

const SAMPLE_FRAMES = 40;
// Constraint: 숫자 입력 확정 지연(300ms)에 먼 연도로 가는 정착 애니메이션까지 끝나야 확정 여부를 알 수 있음
const TYPEAHEAD_WAIT_MILLISECONDS = 1500;

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

const LateColumnYearWheel = ({ onValueChange }: { readonly onValueChange: (value: number) => void }) => {
  const [isShown, setIsShown] = useState(false);
  const [value, setValue] = useState(1990);
  const wheel = useWheel({
    label: 'Year',
    options: years,
    value,
    onValueChange: (next) => {
      setValue(next);
      onValueChange(next);
    },
  });
  const { start, end } = wheel.renderedRange;
  const indexes = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  return (
    <>
      <button type="button" onClick={() => setIsShown(true)}>
        Show
      </button>
      {isShown && (
        <div {...wheel.getColumnProps()}>
          <div {...wheel.getTrackProps()}>
            {indexes.map((index) => (
              <Wheel.Item key={index} wheel={wheel} index={index} />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// Goal: 앱이 ref를 인라인 함수로 감싸면 React는 렌더마다 이전 ref를 null로 부르고 새 ref를 부름
const InlineRefYearWheel = ({ onValueChange }: { readonly onValueChange: (value: number) => void }) => {
  const [renderCount, setRenderCount] = useState(0);
  const [value, setValue] = useState(1990);
  const wheel = useWheel({
    label: 'Year',
    options: years,
    value,
    onValueChange: (next) => {
      setValue(next);
      onValueChange(next);
    },
  });
  const { ref, ...columnProps } = wheel.getColumnProps();
  const { start, end } = wheel.renderedRange;
  const indexes = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  return (
    <>
      <button type="button" onClick={() => setRenderCount(renderCount + 1)}>
        Rerender {renderCount}
      </button>
      <div
        {...columnProps}
        ref={(node) => {
          ref(node);
        }}
      >
        <div {...wheel.getTrackProps()}>
          {indexes.map((index) => (
            <Wheel.Item key={index} wheel={wheel} index={index} />
          ))}
        </div>
      </div>
    </>
  );
};

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const sampleEachFrame = async <Sample,>(read: () => Sample): Promise<readonly Sample[]> => {
  let samples: readonly Sample[] = [];
  for (let frame = 0; frame < SAMPLE_FRAMES; frame += 1) {
    await nextFrame();
    samples = [...samples, read()];
  }
  return samples;
};

const readPosition = (column: HTMLElement | SVGElement): number =>
  Number.parseFloat(column.style.getPropertyValue(WHEEL_POSITION_PROPERTY));

const isItemRendered = (index: number): boolean =>
  [...document.querySelectorAll('[data-lsp-part="wheel-item"]')].some(
    (item) => item instanceof HTMLElement && item.style.getPropertyValue('--lsp-wheel-index') === String(index),
  );

// Goal: 키 입력과 같은 틱에 프레임 표본을 모으기 시작해 애니메이션 중간을 놓치지 않음
const pressKey = (element: Element, key: string): void => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

describe('Wheel', () => {
  it('exposes the column as a spinbutton with readable value text', async () => {
    const screen = await render(<MonthWheel onValueChange={vi.fn()} />);

    const column = screen.getByRole('spinbutton', { name: 'Month' });
    await expect.element(column).toHaveAttribute('aria-valuetext', '1월');
    expect(column.element().style.touchAction).toBe('none');
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

    it('snaps back without reporting anything when every option is disabled', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <WheelProbe label="Day" options={blockedDays} initialValue={1} onValueChange={onValueChange} />,
      );
      const column = screen.getByRole('spinbutton', { name: 'Day' }).element();

      pressKey(column, 'End');
      const positions = await sampleEachFrame(() => readPosition(column));

      expect(Math.max(...positions)).toBeGreaterThan(1);
      expect(positions.at(-1)).toBe(0);
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('keeps the items around the moving position rendered while animating to a far option', async () => {
      const screen = await render(<YearWheel onValueChange={vi.fn()} />);
      const column = screen.getByRole('spinbutton', { name: 'Year' }).element();

      pressKey(column, 'Home');
      const samples = await sampleEachFrame(() => {
        const position = readPosition(column);
        return { position, isRendered: isItemRendered(Math.round(position)) };
      });

      expect(samples.some(({ position }) => position > 1 && position < 1988)).toBe(true);
      expect(samples.filter(({ isRendered }) => !isRendered)).toEqual([]);
    });

    describe('typeahead', () => {
      it('jumps to the option whose label starts with the typed digits', async () => {
        const onValueChange = vi.fn();
        const screen = await render(<YearWheel onValueChange={onValueChange} />);
        const column = screen.getByRole('spinbutton', { name: 'Year' });
        column.element().focus();
        await expect.element(column).toHaveFocus();

        await userEvent.keyboard('1950');

        await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(1950);
      });

      it('reports only the final year when digits are typed quickly, even with reduced motion', async () => {
        // Goal: 애니메이션이 없으면 글자마다 바로 정착하므로 확정을 미루지 않으면 2·20·202가 먼저 알려짐
        const reducedMotion = vi.spyOn(window, 'matchMedia').mockReturnValue(window.matchMedia('(min-width: 0px)'));
        try {
          const onValueChange = vi.fn();
          const screen = await render(<YearWheel onValueChange={onValueChange} />);
          const column = screen.getByRole('spinbutton', { name: 'Year' }).element();

          for (const key of ['2', '0', '2', '6']) pressKey(column, key);

          await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
          await settleEffects();
          expect(onValueChange.mock.calls).toEqual([[2026]]);
        } finally {
          reducedMotion.mockRestore();
        }
      });

      it('leaves whitespace out of the typed prefix', async () => {
        const onValueChange = vi.fn();
        const screen = await render(<YearWheel onValueChange={onValueChange} />);
        const column = screen.getByRole('spinbutton', { name: 'Year' }).element();

        for (const key of ['1', '9', ' ', '5', '0']) pressKey(column, key);

        await expect.poll(() => onValueChange.mock.calls).toEqual([[1950]]);
      });

      it('drops a pending typed year when the column becomes disabled before it commits', async () => {
        const onValueChange = vi.fn();
        const renderColumn = (isDisabled: boolean) => (
          <Wheel.Root aria-label="Year">
            <Wheel.Column
              label="Year"
              options={years}
              value={1990}
              disabled={isDisabled}
              onValueChange={onValueChange}
            />
          </Wheel.Root>
        );
        const screen = await render(renderColumn(false));
        const column = screen.getByRole('spinbutton', { name: 'Year' }).element();

        for (const key of ['1', '9', '5', '0']) pressKey(column, key);
        await screen.rerender(renderColumn(true));
        await new Promise((resolve) => setTimeout(resolve, TYPEAHEAD_WAIT_MILLISECONDS));

        expect(onValueChange.mock.calls).toEqual([]);
      });

      it('ignores typed text that matches no option', async () => {
        const onValueChange = vi.fn();
        const screen = await render(<MonthWheel onValueChange={onValueChange} />);
        const column = screen.getByRole('spinbutton', { name: 'Month' });
        column.element().focus();
        await expect.element(column).toHaveFocus();

        await userEvent.keyboard('x');
        await settleEffects();

        await expect.element(column).toHaveAttribute('aria-valuenow', '0');
        expect(onValueChange.mock.calls).toEqual([]);
      });
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

    it('ends a mouse drag on the next move without buttons when the release was missed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<YearWheel onValueChange={onValueChange} />);
      const item = screen.getByText('1992').element();
      const { height, top } = item.getBoundingClientRect();
      const startY = top + height / 2;

      dispatchMousePointer(item, 'pointerdown', { button: 0, buttons: 1, clientY: startY });
      dispatchMousePointer(document, 'pointermove', { buttons: 1, clientY: startY - height * 3 });
      dispatchMousePointer(document, 'pointermove', { buttons: 0, clientY: startY - height * 3 });

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(1993);
    });

    it('moves exactly one item per wheel notch after re-renders through an inline wrapper ref', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<InlineRefYearWheel onValueChange={onValueChange} />);
      for (const renderCount of [0, 1, 2, 3]) {
        await screen.getByRole('button', { name: `Rerender ${renderCount}` }).click();
      }
      await expect.element(screen.getByRole('button', { name: 'Rerender 4' })).toBeInTheDocument();

      await userEvent.wheel(screen.getByRole('spinbutton', { name: 'Year' }), { delta: { y: firstItemHeight() } });

      await expect.poll(() => onValueChange.mock.calls, { timeout: 2000 }).toEqual([[1991]]);
    });

    it('listens to the mouse wheel on a column that mounts after the hook', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<LateColumnYearWheel onValueChange={onValueChange} />);
      await screen.getByRole('button', { name: 'Show' }).click();
      const column = screen.getByRole('spinbutton', { name: 'Year' });

      await userEvent.wheel(column, { delta: { y: firstItemHeight() * 3 } });

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0], { timeout: 2000 }).toBe(1993);
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
