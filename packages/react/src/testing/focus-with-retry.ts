import { expect } from 'vitest';

// Constraint: 여러 테스트 페이지를 병렬로 띄운 Firefox는 포커스가 없는 iframe에서 focus()를 무시할 때가 있음. iframe 창에 먼저 포커스를 주고 자리 잡을 때까지 다시 시도함. 포커스 동작 자체가 검증 대상인 테스트에는 쓰지 않음(재시도가 부품의 포커스 버그를 가림)
export const focusWithRetry = async (element: HTMLElement): Promise<void> => {
  await expect
    .poll(() => {
      if (element.ownerDocument.activeElement !== element) {
        element.ownerDocument.defaultView?.focus();
        element.focus();
      }
      return element.ownerDocument.activeElement === element;
    })
    .toBe(true);
};
