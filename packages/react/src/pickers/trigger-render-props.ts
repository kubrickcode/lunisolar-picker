import type { ButtonHTMLAttributes, RefAttributes } from 'react';

// Goal: 트리거 버튼 속성과 ref. 앱 트리거에 그대로 펼치면 팝오버 위치 기준과 picker의 ref.focus()가 함께 붙음
export type PickerTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & RefAttributes<HTMLButtonElement>;

// Goal: 필터 칩처럼 앱 고유 트리거를 그릴 때 표시 문자열·열림 상태·버튼 속성을 한 번에 넘김 (계약 §3.5)
export interface TriggerRenderProps {
  readonly displayValue: string;
  readonly isOpen: boolean;
  readonly placeholder: string;
  readonly triggerProps: PickerTriggerProps;
}
