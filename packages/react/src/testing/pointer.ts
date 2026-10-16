import { dispatchMousePointer } from './dispatch-mouse-pointer';

const PRIMARY_BUTTON = 0;
const PRIMARY_BUTTON_PRESSED = 1;
const RELEASED_BUTTONS = 0;

export type PointerInit = Pick<PointerEventInit, 'buttons' | 'clientX' | 'clientY' | 'pointerType'>;

// Goal: 달력 밖으로 나가 머무는 드래그처럼 Playwright 고수준 API로 만들 수 없는 순서를 직접 재현함. 누른 버튼 상태는 이벤트 종류에서 정함
export const dispatchPointer = (target: EventTarget, type: string, init: PointerInit = {}): void => {
  dispatchMousePointer(target, type, {
    button: PRIMARY_BUTTON,
    buttons: type === 'pointerup' ? RELEASED_BUTTONS : PRIMARY_BUTTON_PRESSED,
    isPrimary: true,
    ...init,
  });
};
