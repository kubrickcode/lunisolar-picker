import type { ReactElement } from 'react';
import { expect, type MockInstance, vi } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';
import type { TriggerRenderProps } from '../pickers/index';
import { COARSE_NARROW_SCREEN_QUERY } from '../presentation/use-presentation';
import { focusDirectly } from './focus-directly';
import { focusOnce } from './focus-once';

type SheetOpening = {
  // Goal: 시트가 열린 뒤 처음 포커스를 받는 요소
  readonly initialFocus: Locator;
  readonly trigger: Locator;
};

// Goal: 값을 보이는 트리거의 이름은 "보이는 값 + 동작 라벨"이라 동작 라벨로 끝나는 이름을 찾음
export const endsWith = (label: string): RegExp => new RegExp(`${escapeRegExp(label)}$`);

export const hiddenInputNamed = (name: string): HTMLInputElement => {
  const inputs = inputsNamed(name);
  const [input] = inputs;
  if (inputs.length !== 1 || !input) throw new Error(`expected one input named ${name}, found ${inputs.length}`);
  return input;
};

export const inputsNamed = (name: string): HTMLInputElement[] =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

// Goal: 시트는 다음 프레임에 첫 포커스를 옮기므로 그 포커스가 자리 잡은 뒤에 테스트가 다른 요소에 포커스해야 빼앗기지 않음
export const openSheet = async ({ initialFocus, trigger }: SheetOpening): Promise<void> => {
  await focusOnce(trigger);
  await trigger.click();
  await expect.element(initialFocus).toHaveFocus();
};

// Goal: 테마 없는 시트는 긴 목록·휠 아래로 버튼이 화면 밖에 놓이고 스크롤이 잠겨 포인터로 누를 수 없으므로 키보드로 누름 (preflight 2.10)
export const pressWithKeyboard = async (locator: Locator): Promise<void> => {
  await focusDirectly(locator);
  await userEvent.keyboard('{Enter}');
};

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

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
