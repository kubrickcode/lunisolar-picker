import { expect } from 'vitest';
import type { Locator } from 'vitest/browser';

// Goal: 클릭으로 옮긴 포커스가 실제로 자리 잡은 뒤에 키를 보냄. 부하가 걸린 Firefox에서 키가 클릭 포커스보다 먼저 도착해 다른 칸에 숫자가 들어간 적이 있음
export const clickToFocus = async (locator: Locator): Promise<void> => {
  await locator.click();
  await expect.element(locator).toHaveFocus();
};
