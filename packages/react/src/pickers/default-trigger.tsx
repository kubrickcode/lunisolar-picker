import { type ReactElement, type ReactNode, useId } from 'react';
import type { PickerTriggerProps } from './trigger-render-props';

type DefaultTriggerProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly triggerProps: PickerTriggerProps;
};

type ValueTriggerProps = DefaultTriggerProps & {
  readonly placeholder: string | undefined;
  // Goal: 고른 값. 비어 있으면 placeholder를 보임
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
// Constraint: 이름은 "보이는 값 + 동작 라벨"이라 음성 제어로 보이는 값을 말해도 눌림 (WCAG 2.5.3). 자기 id를 가리키는 자리에서는 aria-label(동작 라벨 또는 앱 라벨)이 쓰임 (accname 2B)
// Constraint: 앱이 aria-labelledby를 주면 보이는 값 뒤에 앱이 가리킨 라벨을 이어 붙임. 보이는 값이 없으면 라벨만 씀
export const ValueTrigger = ({ triggerProps, label, icon, placeholder, text }: ValueTriggerProps): ReactElement => {
  const ownId = useId();
  const textId = useId();
  const triggerId = triggerProps.id ?? ownId;
  const appLabelledBy = triggerProps['aria-labelledby'];
  // Goal: 빈 트리거가 아이콘만 남아 무엇을 고르는 칸인지 모르는 일을 막음. 이름을 정하는 라벨을 그대로 보여 이름과 보이는 글이 같음
  // Constraint: 앱이 aria-labelledby로 보이는 라벨을 이미 가리키면 그 라벨이 이름이므로 기본 글을 덧붙이지 않음
  const visibleText = text || (placeholder ?? (appLabelledBy === undefined ? label : ''));
  const isNamedByLabelAlone = visibleText === '' || (appLabelledBy === undefined && visibleText === label);
  const labelledBy = isNamedByLabelAlone ? appLabelledBy : `${textId} ${appLabelledBy ?? triggerId}`;
  return (
    <button {...triggerProps} id={triggerId} type="button" aria-label={label} aria-labelledby={labelledBy}>
      {icon}
      {visibleText === '' ? null : <span id={textId}>{visibleText}</span>}
    </button>
  );
};
