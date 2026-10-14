import type { CSSProperties, ReactElement } from 'react';

const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  blockSize: 1,
  border: 0,
  clipPath: 'inset(50%)',
  inlineSize: 1,
  margin: -1,
  opacity: 0,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
};

export type HiddenInputProps = {
  readonly disabled?: boolean | undefined;
  readonly form?: string | undefined;
  readonly name?: string | undefined;
  readonly onFocusRequest: () => void;
  readonly required?: boolean | undefined;
  readonly value: string;
};

// Goal: 네이티브 form 제출과 required 검증을 받기 위한 숨은 입력. type=hidden은 required 검증에서 빠지므로 text로 두고 화면에서만 숨김
export const HiddenInput = ({
  name,
  form,
  value,
  required,
  disabled,
  onFocusRequest,
}: HiddenInputProps): ReactElement | null => {
  if (name === undefined) return null;
  return (
    <input
      aria-hidden="true"
      autoComplete="off"
      tabIndex={-1}
      type="text"
      name={name}
      form={form}
      value={value}
      required={required}
      disabled={disabled}
      onChange={ignoreChange}
      onFocus={onFocusRequest}
      style={VISUALLY_HIDDEN_STYLE}
    />
  );
};

// Constraint: readOnly는 required 검증에서 빠지므로 쓰지 않음. 값은 부품이 정하고, onChange는 제어 input 경고를 막는 용도뿐
const ignoreChange = (): void => {};
