import { type RefCallback, useCallback, useState } from 'react';

const MODAL_DIALOG_SELECTOR = 'dialog:modal';
const OPEN_DIALOG_SELECTOR = 'dialog[open]';

export type PortalContainer = {
  readonly anchorRef: RefCallback<HTMLTemplateElement>;
  readonly container: HTMLElement | null;
};

// Goal: 열린 모달 dialog 안에서 연 표면은 그 dialog 안에 그려야 브라우저 최상위 층 위에서 보이고 조작됨. 나중에 비네이티브 모달을 지원할 때는 이 함수 앞에 공개 prop만 얹음
export const resolvePortalContainer = (anchor: Element): HTMLElement =>
  anchor.closest<HTMLElement>(findModalDialogSelector()) ?? anchor.ownerDocument.body;

// Constraint: :modal은 Chrome 105·Safari 15.6부터라 하한(Chrome 99·Safari 15.5)에서는 열린 dialog로 대신 찾음. 그 브라우저에서는 show()로 연 비모달 dialog도 걸리는 것을 감수함. SSR 안전을 위해 호출 시점에 판정함
const findModalDialogSelector = (): string =>
  CSS.supports(`selector(${MODAL_DIALOG_SELECTOR})`) ? MODAL_DIALOG_SELECTOR : OPEN_DIALOG_SELECTOR;

export const usePortalContainer = (): PortalContainer => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Constraint: ref 콜백이 렌더마다 새 함수면 React가 매번 null과 요소로 다시 부름. 열릴 때마다 앵커가 새로 붙으므로 위치는 매번 다시 구함
  const anchorRef = useCallback((node: HTMLTemplateElement | null) => {
    setContainer(node ? resolvePortalContainer(node) : null);
  }, []);
  return { anchorRef, container };
};
