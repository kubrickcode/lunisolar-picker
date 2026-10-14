import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { useLatestRef } from '../utilities/use-latest-ref';

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
  // Goal: 소속 form이 reset되면 부품이 기본값으로 돌아가게 알림. 제어 모드인지는 부품이 판단함
  readonly onFormReset?: (() => void) | undefined;
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
  onFormReset,
}: HiddenInputProps): ReactElement | null => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onFormResetRef = useLatestRef(onFormReset);

  // Constraint: form 속성으로 바깥 form에 속할 수도 있으므로 DOM이 정한 소속 form(input.form)에 붙임. name이 없으면 input이 없어 폼과 무관함
  // biome-ignore lint/correctness/useExhaustiveDependencies: form·name이 바뀌면 소속 form이 바뀌거나 input이 생기고 사라지므로 다시 붙여야 함
  useEffect(() => {
    const owner = inputRef.current?.form;
    if (!owner) return;
    const resetField = (): void => onFormResetRef.current?.();
    owner.addEventListener('reset', resetField);
    return () => owner.removeEventListener('reset', resetField);
  }, [form, name, onFormResetRef]);

  if (name === undefined) return null;
  return (
    <input
      ref={inputRef}
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
