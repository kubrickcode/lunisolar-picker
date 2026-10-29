import type { Locator } from 'vitest/browser';

// Goal: 역할로 찾은 form을 단언 없이 HTMLFormElement로 좁혀 FormData·reset에 씀
export const formElementOf = (locator: Locator): HTMLFormElement => {
  const element = locator.element();
  if (!(element instanceof HTMLFormElement)) throw new Error('the locator does not point to a form element');
  return element;
};
