import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';
import { focusWithRetry } from './focus-with-retry';

// Goal: 누르면 동작하는 버튼(월·연 고르기)이나 비활성 버튼에 클릭 없이 포커스를 둔 뒤 자리 잡았는지 확인함
export const focusDirectly = async (locator: Locator): Promise<void> => {
  const element = locator.element();
  if (element instanceof HTMLElement) await focusWithRetry(element);
  await expect.element(locator).toHaveFocus();
};
