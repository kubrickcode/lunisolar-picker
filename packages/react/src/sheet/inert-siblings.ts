const ARIA_HIDDEN = 'aria-hidden';

// Goal: 모달 시트가 열린 동안 뒤 화면을 보조기기와 포커스에서 숨김 (스펙 10.4)
export const makeSiblingsInert = (container: HTMLElement): (() => void) => {
  const siblings = Array.from(document.body.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element !== container && !element.inert,
  );
  const previousAriaHidden = siblings.map((element) => element.getAttribute(ARIA_HIDDEN));
  for (const element of siblings) {
    element.inert = true;
    element.setAttribute(ARIA_HIDDEN, 'true');
  }
  return () => {
    siblings.forEach((element, index) => {
      element.inert = false;
      const previous = previousAriaHidden[index] ?? null;
      if (previous === null) element.removeAttribute(ARIA_HIDDEN);
      else element.setAttribute(ARIA_HIDDEN, previous);
    });
  };
};
