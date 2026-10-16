import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';

type PickerClearButtonProps = {
  // Constraint: picker가 locale prop을 받으면 Provider와 다를 수 있으므로 picker가 해석한 문구(labels.clear)를 받음
  readonly label: string;
  readonly onClear: () => void;
};

// Goal: 값을 한 번에 비우는 버튼 (스펙 2 clearable). 표면 밖, 입력 칸이나 트리거 옆에 두어 달력을 열지 않고 지움
// Constraint: 보이는 글이 없는 아이콘 버튼이라 이름은 aria-label뿐이어서 음성 제어 이름 불일치(WCAG 2.5.3)가 생기지 않음
export const PickerClearButton = ({ label, onClear }: PickerClearButtonProps): ReactElement => (
  <button type="button" aria-label={label} onClick={onClear} {...partAttributes('picker-clear')}>
    <ClearIcon />
  </button>
);

const ClearIcon = (): ReactElement => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
