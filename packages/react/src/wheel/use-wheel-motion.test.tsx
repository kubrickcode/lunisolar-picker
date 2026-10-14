// Constraint: 테마의 rotateX 변형이 있어야 항목 크기 측정을 검증할 수 있음. CSS가 다른 휠 테스트에 섞이지 않게 이 파일에만 불러옴
import '@lunisolar-picker/theme/mono.css';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { dispatchMousePointer } from '../testing/dispatch-mouse-pointer';
import * as Wheel from './parts';

const DRAGGED_ITEM_COUNT = 3;
const INITIAL_YEAR = 2026;

const years = Array.from({ length: 9999 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
  isDisabled: false,
}));

const ThemedYearWheel = ({ onValueChange }: { readonly onValueChange: (value: number) => void }) => {
  const [value, setValue] = useState(INITIAL_YEAR);
  return (
    <Wheel.Root aria-label="Year">
      <Wheel.Highlight />
      <Wheel.Column
        label="Year"
        options={years}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    </Wheel.Root>
  );
};

const layoutHeightOf = (element: Element): number => {
  if (!(element instanceof HTMLElement)) throw new Error('wheel item is not an HTML element');
  return element.offsetHeight;
};

describe('useWheelMotion', () => {
  describe('item size', () => {
    it('moves one item per item height dragged while the theme rotates the items', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ThemedYearWheel onValueChange={onValueChange} />);
      const item = screen.getByText(String(INITIAL_YEAR)).element();
      const itemSize = layoutHeightOf(item);
      const { height, top } = item.getBoundingClientRect();
      const startY = top + height / 2;
      const endY = startY - itemSize * DRAGGED_ITEM_COUNT;

      dispatchMousePointer(item, 'pointerdown', { button: 0, buttons: 1, clientY: startY });
      dispatchMousePointer(document, 'pointermove', { buttons: 1, clientY: endY });
      dispatchMousePointer(document, 'pointermove', { buttons: 0, clientY: endY });

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(INITIAL_YEAR + DRAGGED_ITEM_COUNT);
    });
  });
});
