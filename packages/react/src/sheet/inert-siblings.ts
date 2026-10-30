const ARIA_HIDDEN = 'aria-hidden';

type InertEntry = {
  readonly count: number;
  readonly previousAriaHidden: string | null;
};

// Constraint: 겹쳐 열린 시트가 같은 형제를 함께 잠그므로 요소별 참조 수를 셈. 닫는 순서와 무관하게 마지막 해제 때만 복원함. DOM 전역이라 모듈 상태가 허용되는 경우
const entries = new Map<HTMLElement, InertEntry>();

// Goal: 모달 시트가 열린 동안 뒤 화면을 보조기기와 포커스에서 숨김 (스펙 10.4). 중첩 컨테이너(모달 dialog 안 포털)는 조상 경로를 막지 않음
export const makeSiblingsInert = (container: HTMLElement): (() => void) => {
  const acquired = collectSiblingsUpToBody(container).flatMap((element) => (acquire(element) ? [element] : []));
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    for (const element of acquired) release(element);
  };
};

const collectSiblingsUpToBody = (container: HTMLElement): HTMLElement[] => {
  const siblings: HTMLElement[] = [];
  let current: HTMLElement = container;
  let parent = current.parentElement;
  while (parent) {
    for (const element of parent.children) {
      if (element instanceof HTMLElement && element !== current) siblings.push(element);
    }
    if (parent === document.body) break;
    current = parent;
    parent = current.parentElement;
  }
  return siblings;
};

const acquire = (element: HTMLElement): boolean => {
  const entry = entries.get(element);
  if (entry) {
    entries.set(element, { ...entry, count: entry.count + 1 });
    return true;
  }
  if (element.inert) return false;
  entries.set(element, { count: 1, previousAriaHidden: element.getAttribute(ARIA_HIDDEN) });
  element.inert = true;
  element.setAttribute(ARIA_HIDDEN, 'true');
  return true;
};

const release = (element: HTMLElement): void => {
  const entry = entries.get(element);
  if (!entry) return;
  if (entry.count > 1) {
    entries.set(element, { ...entry, count: entry.count - 1 });
    return;
  }
  entries.delete(element);
  element.inert = false;
  if (entry.previousAriaHidden === null) element.removeAttribute(ARIA_HIDDEN);
  else element.setAttribute(ARIA_HIDDEN, entry.previousAriaHidden);
};
