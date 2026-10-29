import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach } from 'vitest';

const HYDRATION_SETTLE_FRAMES = 2;
const pendingUnmounts = new Set<() => void>();

export type HydrationResult = {
  readonly container: HTMLElement;
  readonly recoverableErrors: readonly unknown[];
  readonly unmount: () => void;
};

// Side effect: 모듈 로드 시 테스트가 끝날 때 남은 hydration 루트를 정리하는 afterEach를 등록함
afterEach(() => {
  [...pendingUnmounts].forEach((unmount) => {
    unmount();
  });
});

export const renderWithHydration = async (element: ReactElement): Promise<HydrationResult> => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.append(container);
  // 수집 배열은 hydration 콜백이 채우는 출력 통로라 의도적으로 변경함
  const recoverableErrors: unknown[] = [];
  const root = hydrateRoot(container, element, { onRecoverableError: (error) => recoverableErrors.push(error) });
  const unmount = (): void => {
    if (!pendingUnmounts.delete(unmount)) return;
    root.unmount();
    container.remove();
  };
  pendingUnmounts.add(unmount);
  for (let frame = 0; frame < HYDRATION_SETTLE_FRAMES; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return { container, recoverableErrors, unmount };
};
