import { type RefObject, useEffect, useRef, useState } from 'react';

type FieldRemount = {
  readonly fieldKey: number;
  readonly fieldRef: RefObject<{ focus(): void } | null>;
  remountField(): void;
};

type FieldRemountOptions = {
  // Goal: 다시 마운트하기 전에 포커스가 입력 칸 안에 있었는지 볼 입력 칸 부품
  readonly fieldSelector: string;
  readonly rootRef: RefObject<HTMLElement | null>;
};

// Goal: form reset 뒤 값이 그대로여도 입력 칸에 남은 미완성 입력을 지우려고 입력 칸을 새로 마운트함. 입력 중이던 사용자의 포커스는 잃지 않게 새 입력 칸으로 돌려줌
export const useFieldRemount = ({ fieldSelector, rootRef }: FieldRemountOptions): FieldRemount => {
  const [fieldKey, setFieldKey] = useState(0);
  const fieldRef = useRef<{ focus(): void } | null>(null);
  const shouldRefocusFieldRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 새로 마운트한 입력 칸에 포커스해야 하므로 reset 횟수가 바뀐 커밋 뒤에 돌아야 함
  useEffect(() => {
    if (!shouldRefocusFieldRef.current) return;
    // 의도적 변경: 다시 포커스할 요청은 한 번만 씀
    shouldRefocusFieldRef.current = false;
    fieldRef.current?.focus();
  }, [fieldKey]);

  const remountField = (): void => {
    const field = rootRef.current?.querySelector(fieldSelector);
    // 의도적 변경: 다시 마운트한 뒤 포커스를 돌려줄지 렌더와 무관하게 기억함
    shouldRefocusFieldRef.current = field?.contains(document.activeElement) === true;
    setFieldKey((count) => count + 1);
  };

  return { fieldKey, fieldRef, remountField };
};
