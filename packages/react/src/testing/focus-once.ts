import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';

// Goal: 포커스 동작 자체를 검증하는 테스트의 준비 단계. focusWithRetry와 달리 다시 포커스하지 않아 부품이 포커스를 옮기거나 빼앗는 버그를 가리지 않음
// Constraint: 병렬 Firefox는 포커스가 없는 iframe에서 focus()를 무시할 때가 있어 창에 먼저 포커스를 줌
export const focusOnce = async (locator: Locator): Promise<void> => {
  const element = locator.element();
  if (element instanceof HTMLElement) {
    element.ownerDocument.defaultView?.focus();
    element.focus();
  }
  await expect.element(locator).toHaveFocus();
};
