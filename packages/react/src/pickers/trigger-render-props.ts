import type { ButtonHTMLAttributes } from 'react';

// Goal: 필터 칩처럼 앱 고유 트리거를 그릴 때 표시 문자열·열림 상태·버튼 속성을 한 번에 넘김 (계약 §3.5)
export interface TriggerRenderProps {
  readonly displayValue: string;
  readonly isOpen: boolean;
  readonly placeholder: string;
  readonly triggerProps: ButtonHTMLAttributes<HTMLButtonElement>;
}
