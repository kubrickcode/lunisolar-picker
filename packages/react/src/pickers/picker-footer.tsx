import type { LocaleLabels } from '@lunisolar-picker/core';
import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { Sheet } from '../index';

type PickerCloseFooterProps = {
  readonly label: string;
};

type PickerFooterProps = {
  readonly isConfirmDisabled: boolean;
  // Constraint: picker가 locale prop을 받으면 Provider와 다를 수 있으므로 picker가 해석한 문구를 받음 (preflight 3.8)
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export const PickerFooter = ({ isConfirmDisabled, labels, onCancel, onConfirm }: PickerFooterProps): ReactElement => (
  <div {...partAttributes('picker-footer')}>
    <button type="button" onClick={onCancel}>
      {labels.cancel}
    </button>
    <button type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
      {labels.confirm}
    </button>
  </div>
);

// Goal: 시트는 Esc가 없는 터치 기기에서 열리므로 배경 탭 말고도 보이는 닫기 버튼을 둠 (스펙 10.4). Sheet.Root 안에서만 씀
export const PickerCloseFooter = ({ label }: PickerCloseFooterProps): ReactElement => (
  <div {...partAttributes('picker-footer')}>
    <Sheet.Close>{label}</Sheet.Close>
  </div>
);
