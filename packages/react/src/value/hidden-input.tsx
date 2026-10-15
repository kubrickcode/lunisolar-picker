import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { useLatestRef } from '../utilities/use-latest-ref';
import { VISUALLY_HIDDEN_STYLE } from '../utilities/visually-hidden';

// Goal: M3 숨은 입력의 모양(투명도 0 포함)을 그대로 둠. 이 입력은 보조 기술에서도 aria-hidden이라 읽힐 필요가 없음
const HIDDEN_INPUT_STYLE: CSSProperties = { ...VISUALLY_HIDDEN_STYLE, opacity: 0 };

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
      style={HIDDEN_INPUT_STYLE}
    />
  );
};

// Constraint: readOnly는 required 검증에서 빠지므로 쓰지 않음. 값은 부품이 정하고, onChange는 제어 input 경고를 막는 용도뿐
const ignoreChange = (): void => {};
