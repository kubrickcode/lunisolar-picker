import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const AUTOFOCUS_SELECTOR = '[data-autofocus]';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
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
    (element) => !element.closest('[inert]'),
  );

export const trapTabKey = (event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement): void => {
  if (event.key !== 'Tab') return;
  const focusableElements = getFocusableElements(container);
  const first = focusableElements[0];
  const last = focusableElements.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const isLeavingStart = event.shiftKey && document.activeElement === first;
  const isLeavingEnd = !event.shiftKey && document.activeElement === last;
  if (!isLeavingStart && !isLeavingEnd) return;
  event.preventDefault();
  (isLeavingStart ? last : first).focus();
};
