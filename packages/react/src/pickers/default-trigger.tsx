import type { ReactElement, ReactNode } from 'react';
import type { PickerTriggerProps } from './trigger-render-props';

type DefaultTriggerProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly triggerProps: PickerTriggerProps;
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
