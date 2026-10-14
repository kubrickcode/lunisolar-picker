import { useSyncExternalStore } from 'react';

export type Presentation = 'auto' | 'popover' | 'sheet';
export type ResolvedPresentation = 'popover' | 'sheet';

// Goal: 터치 기기이면서 좁은 화면이면 팝오버 대신 바텀시트로 엶 (스펙 7.5)
export const COARSE_NARROW_SCREEN_QUERY = '(pointer: coarse) and (max-width: 640px)';

export const resolvePresentation = (
  presentation: Presentation,
  isCoarseNarrowScreen: boolean,
): ResolvedPresentation => {
  if (presentation !== 'auto') return presentation;
  return isCoarseNarrowScreen ? 'sheet' : 'popover';
};

export const usePresentation = (presentation: Presentation): ResolvedPresentation => {
  const isCoarseNarrowScreen = useSyncExternalStore(
    subscribeToScreen,
    readIsCoarseNarrowScreen,
    readServerIsCoarseNarrowScreen,
  );
  return resolvePresentation(presentation, isCoarseNarrowScreen);
};

const subscribeToScreen = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(COARSE_NARROW_SCREEN_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const readIsCoarseNarrowScreen = (): boolean => window.matchMedia(COARSE_NARROW_SCREEN_QUERY).matches;

// Constraint: 서버는 화면을 모르므로 팝오버로 그리고, hydration 뒤 브라우저 판정으로 바꿈
const readServerIsCoarseNarrowScreen = (): boolean => false;
