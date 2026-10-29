import { useSyncExternalStore } from 'react';

const subscribeNever = (): (() => void) => () => {};

// Goal: 서버 렌더와 hydration 첫 렌더는 false라 document에 닿는 포털을 그 뒤에 붙임
export const useIsClient = (): boolean =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
