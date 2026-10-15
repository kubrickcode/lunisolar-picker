import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';
import { focusWithRetry } from './focus-with-retry';

// Goal: 클릭으로 옮긴 포커스가 실제로 자리 잡은 뒤에 키를 보냄. 부하가 걸린 Firefox에서 키가 클릭 포커스보다 먼저 도착해 다른 칸에 숫자가 들어간 적이 있음
// Constraint: 클릭이 포커스를 옮기지 못했을 때만 직접 포커스함. 클릭 핸들러는 이미 실행된 뒤라 동작 검증에는 영향이 없음
export const clickToFocus = async (locator: Locator): Promise<void> => {
  await locator.click();
  const element = locator.element();
  if (element instanceof HTMLElement) await focusWithRetry(element);
  await expect.element(locator).toHaveFocus();
};
