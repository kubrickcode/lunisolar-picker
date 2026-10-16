import { type PointerEvent, useRef } from 'react';
import type { PickerTriggerProps } from './trigger-render-props';

type AppTriggerOptions = {
  readonly isOpen: boolean;
  readonly labelProps: TriggerLabelProps;
  readonly onBlur: (() => void) | undefined;
};

// Goal: 입력 칸이 없으므로 picker가 받은 라벨·id가 트리거의 것이 됨
type TriggerLabelProps = Pick<PickerTriggerProps, 'aria-describedby' | 'aria-label' | 'aria-labelledby' | 'id'>;

// Goal: 앱 트리거 모드에서는 입력 칸 대신 트리거가 picker의 이름과 떠남(onBlur)을 맡음 (계약 §3.5)
export const useAppTriggerProps = ({
  isOpen,
  labelProps,
  onBlur,
}: AppTriggerOptions): ((triggerProps: PickerTriggerProps) => PickerTriggerProps) => {
  const isPressingTriggerRef = useRef(false);

  // Constraint: 팝오버 안으로 옮겨 가는 포커스는 picker를 떠난 것이 아니므로 닫혀 있을 때만 알림
  // Constraint: Safari는 누른 버튼에 포커스를 주지 않아 트리거를 누르는 순간 트리거가 blur됨. 여는 동작이라 떠남으로 보지 않음
  // Constraint: 누름 때문의 blur는 pointerdown 중에 일어나므로 누름이 끝나면 표시를 지워 이후의 진짜 떠남을 삼키지 않음
  // Constraint: 누른 채 트리거 밖으로 끌어 놓으면 트리거에는 pointerup이 오지 않으므로 문서에서 캡처 단계로 한 번만 받아 지움
  const pressTrigger = (event: PointerEvent<HTMLButtonElement>): void => {
    // 의도적 변경: 렌더와 무관한 누름 표시
    isPressingTriggerRef.current = true;
    const pressEnd = new AbortController();
    const releaseTriggerPress = (): void => {
      // 의도적 변경: 렌더와 무관한 누름 표시
      isPressingTriggerRef.current = false;
      pressEnd.abort();
    };
    const listenerOptions = { capture: true, signal: pressEnd.signal };
    event.currentTarget.ownerDocument.addEventListener('pointerup', releaseTriggerPress, listenerOptions);
    event.currentTarget.ownerDocument.addEventListener('pointercancel', releaseTriggerPress, listenerOptions);
  };

  const leaveTrigger = (): void => {
    const isPressing = isPressingTriggerRef.current;
    // 의도적 변경: 누름 표시는 한 번의 blur에만 씀
    isPressingTriggerRef.current = false;
    if (!isOpen && !isPressing) onBlur?.();
  };

  return (triggerProps) => ({
    ...triggerProps,
    ...labelProps,
    onBlur: leaveTrigger,
    onClick: (event) => {
      // 의도적 변경: 누름이 끝났으므로 다음 blur는 다시 떠남으로 봄
      isPressingTriggerRef.current = false;
      triggerProps.onClick?.(event);
    },
    onPointerDown: pressTrigger,
  });
};
