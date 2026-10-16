import type { LocaleLabels } from '@lunisolar-picker/core';
import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';

export interface PickerFooterProps {
  readonly isConfirmDisabled: boolean;
  // Constraint: picker가 locale prop을 받으면 Provider와 다를 수 있으므로 picker가 해석한 문구를 받음 (preflight 3.8)
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

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
