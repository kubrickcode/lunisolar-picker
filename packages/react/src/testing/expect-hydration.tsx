import type { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

const HYDRATION_SETTLE_FRAMES = 2;

export interface HydrationResult {
  readonly container: HTMLElement;
  readonly recoverableErrors: readonly unknown[];
  unmount(): void;
}

export const renderWithHydration = async (element: ReactElement): Promise<HydrationResult> => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.append(container);
  // 수집 배열은 hydration 콜백이 채우는 출력 통로라 의도적으로 변경함
  const recoverableErrors: unknown[] = [];
  const root = hydrateRoot(container, element, { onRecoverableError: (error) => recoverableErrors.push(error) });
  for (let frame = 0; frame < HYDRATION_SETTLE_FRAMES; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return {
    container,
    recoverableErrors,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
};
