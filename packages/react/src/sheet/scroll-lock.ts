type SavedBodyStyle = {
  readonly insetInline: string;
  readonly overflow: string;
  readonly paddingInlineEnd: string;
  readonly position: string;
  readonly top: string;
};

// Constraint: 문서 전체에 하나뿐인 body 잠금을 여러 시트가 공유하므로 잠금 수를 셈. DOM 전역이라 모듈 상태가 허용되는 유일한 경우
let activeLockCount = 0;
let restoreBody: (() => void) | null = null;

export const lockBodyScroll = (): (() => void) => {
  activeLockCount += 1;
  if (activeLockCount === 1) restoreBody = applyBodyLock();
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    activeLockCount -= 1;
    if (activeLockCount > 0) return;
    restoreBody?.();
    restoreBody = null;
  };
};

// Constraint: iOS Safari는 body overflow:hidden만으로 뒤 화면 스크롤이 막히지 않음 → body를 고정하고 닫을 때 위치를 되돌림 (스펙 10.4)
const applyBodyLock = (): (() => void) => {
  const { body, documentElement } = document;
  const scrollY = window.scrollY;
  const saved: SavedBodyStyle = {
    insetInline: body.style.insetInline,
    overflow: body.style.overflow,
    paddingInlineEnd: body.style.paddingInlineEnd,
    position: body.style.position,
    top: body.style.top,
  };
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  Object.assign(body.style, {
    insetInline: '0',
    overflow: 'hidden',
    paddingInlineEnd: `${scrollbarWidth}px`,
    position: 'fixed',
    top: `-${scrollY}px`,
  });
  return () => {
    Object.assign(body.style, saved);
    window.scrollTo(0, scrollY);
  };
};
