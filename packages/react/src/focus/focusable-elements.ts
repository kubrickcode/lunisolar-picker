import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

// Goal: 열릴 때 처음 포커스할 요소 표시. 스타일 계약(DATA_ATTRIBUTES)이 아니라 동작 훅이라 따로 둠 (M4 preflight 3.3)
export const AUTOFOCUS_ATTRIBUTE = 'data-autofocus';
const AUTOFOCUS_SELECTOR = `[${AUTOFOCUS_ATTRIBUTE}]`;
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Goal: 달력이 열리면 선택된 날(없으면 오늘)에 포커스가 가야 함. 부품은 그 칸에 data-autofocus를 붙임 (스펙 10.4)
export const focusInitialElement = (container: HTMLElement): void => {
  const target =
    container.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ?? getFocusableElements(container)[0] ?? container;
  target.focus({ preventScroll: true });
};

export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest('[inert]') && isRendered(element),
  );

export const trapTabKey = (event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement): void => {
  if (event.key !== 'Tab') return;
  const focusableElements = getFocusableElements(container);
  const first = focusableElements[0];
  const last = focusableElements.at(-1);
  if (!first || !last) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }
  const isTabbableFocused = focusableElements.includes(document.activeElement as HTMLElement); // as: activeElement는 목록 비교용 요소임
  const isLeavingStart = event.shiftKey && (!isTabbableFocused || document.activeElement === first);
  const isLeavingEnd = !event.shiftKey && (!isTabbableFocused || document.activeElement === last);
  if (!isLeavingStart && !isLeavingEnd) return;
  event.preventDefault();
  (isLeavingStart ? last : first).focus();
};

// Constraint: display:none 요소는 클라이언트 사각형이 없음. checkVisibility는 WebKit 지원이 늦어 사용하지 않음
const isRendered = (element: HTMLElement): boolean => element.getClientRects().length > 0;
