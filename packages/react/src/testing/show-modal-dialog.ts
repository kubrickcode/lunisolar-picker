import { expect, onTestFinished } from 'vitest';

// Goal: 소비자 앱처럼 showModal()로 띄운 dialog 안에서 부품을 쓰는 준비 단계. 다음 테스트로 최상위 층이 새지 않게 끝나면 닫음
export const showModalDialog = (container: HTMLElement): HTMLDialogElement => {
  const dialog = container.querySelector('dialog');
  expect(dialog).toBeInstanceOf(HTMLDialogElement);
  const modalDialog = dialog as HTMLDialogElement;
  modalDialog.showModal();
  onTestFinished(() => modalDialog.close());
  return modalDialog;
};
