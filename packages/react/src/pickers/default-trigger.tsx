import type { ReactElement, ReactNode } from 'react';
import type { PickerTriggerProps } from './trigger-render-props';

type DefaultTriggerProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly triggerProps: PickerTriggerProps;
};

type ValueTriggerProps = DefaultTriggerProps & {
  // Goal: 고른 값(없으면 placeholder). 비어 있으면 아이콘만 보임
  readonly text: string;
};

// Constraint: 부품 이름(popover-trigger)과 data-open은 PickerSurface가 triggerProps에 담아 주므로 앱 트리거와 같은 스타일 계약을 탐
export const DefaultTrigger = ({ triggerProps, label, icon }: DefaultTriggerProps): ReactElement => (
  <button {...triggerProps} type="button" aria-label={label}>
    {icon}
  </button>
);

export const CalendarIcon = (): ReactElement => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

export const ClockIcon = (): ReactElement => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
);

// Goal: 입력 칸이 없는 picker(월, 시트 휠)는 트리거가 값을 보여 줌
// Constraint: 이름은 동작 라벨이라 보이는 값을 가림(WCAG 2.5.3). M4는 이 이름을 지키고 보이는 값을 이름·설명에 잇는 일은 M5 접근성 QA로 남김 (preflight 4.11)
export const ValueTrigger = ({ triggerProps, label, icon, text }: ValueTriggerProps): ReactElement => (
  <button {...triggerProps} type="button" aria-label={label}>
    {icon}
    {text === '' ? null : <span>{text}</span>}
  </button>
);
