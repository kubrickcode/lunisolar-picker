import type { ReactElement } from 'react';
import { type MockInstance, vi } from 'vitest';
import type { TriggerRenderProps } from '../pickers/index';
import { COARSE_NARROW_SCREEN_QUERY } from '../presentation/use-presentation';

export const hiddenInputNamed = (name: string): HTMLInputElement => {
  const inputs = inputsNamed(name);
  const [input] = inputs;
  if (inputs.length !== 1 || !input) throw new Error(`expected one input named ${name}, found ${inputs.length}`);
  return input;
};

export const inputsNamed = (name: string): HTMLInputElement[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

export const renderChipTrigger = ({ displayValue, placeholder, triggerProps }: TriggerRenderProps): ReactElement => (
  <button {...triggerProps} type="button" data-testid="chip">
    {displayValue || placeholder}
  </button>
);

// Goal: 터치 기기의 좁은 화면 판정만 참이 되게 함. 다른 미디어 질의는 그대로 거짓
export const stubCoarseNarrowScreen = (): MockInstance<(query: string) => MediaQueryList> =>
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
