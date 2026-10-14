const MOUSE_POINTER_ID = 7;

// Goal: 문서 캡처 리스너까지 거치는 실제 포인터 이벤트를 원하는 좌표로 보냄. userEvent 끌기는 중간 좌표와 버튼 상태를 정할 수 없음
export const dispatchMousePointer = (target: EventTarget, type: string, init: PointerEventInit): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: MOUSE_POINTER_ID,
      pointerType: 'mouse',
      ...init,
    }),
  );
};
