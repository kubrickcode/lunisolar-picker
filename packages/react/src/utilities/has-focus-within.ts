// Goal: 누를 때 버튼에 포커스를 주는 브라우저(Chromium 등)인지, 포커스가 이미 부품 안에 있는지 가림. 밖에 있으면 부품이 포커스를 끌어오지 않음
export const hasFocusWithin = (root: HTMLElement | null): boolean =>
  root?.contains(root.ownerDocument.activeElement) ?? false;
