import { type HTMLAttributes, type KeyboardEvent, type RefCallback, useCallback, useEffect, useRef } from 'react';
import { type DataAttributeProps, type PartName, partAttributes } from '../contract/data-attributes';
import { escapeHtml } from '../utilities/escape-html';
import { useLatestRef } from '../utilities/use-latest-ref';
import { commandFromKey, commandsFromInput, readPastedText, type SegmentCommand } from './segment-commands';

export type SegmentDescription = {
  readonly canToggleLeapMonth: boolean;
  readonly displayText: string;
  readonly isPlaceholder: boolean;
  readonly label: string;
  readonly maxValue: number;
  readonly minValue: number;
  readonly value: number | null;
  readonly valueText: string;
};

export type SegmentedField = {
  readonly focusSegment: (index: number) => void;
  readonly getSegmentProps: (index: number) => SegmentElementProps;
  readonly isFocusWithin: boolean;
  readonly rootRef: RefCallback<HTMLElement>;
};

export type SegmentedFieldOptions = {
  readonly describeSegment: (index: number) => SegmentDescription;
  readonly focusedIndex: number | null;
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
  readonly isReadOnly: boolean;
  readonly isRequired: boolean;
  readonly segmentCount: number;
  readonly segmentPart: PartName;
  readonly sendCommand: (command: SegmentCommand) => void;
};

export type SegmentElementProps = HTMLAttributes<HTMLSpanElement> &
  DataAttributeProps & {
    readonly dangerouslySetInnerHTML: { readonly __html: string };
    readonly ref: RefCallback<HTMLSpanElement>;
  };

type SegmentElementListeners = {
  readonly isEditable: () => boolean;
  readonly readExpectedText: () => string;
  readonly sendCommands: (commands: readonly SegmentCommand[]) => void;
};

export const useSegmentedField = (options: SegmentedFieldOptions): SegmentedField => {
  const latest = useLatestRef(options);
  const rootRef = useRef<HTMLElement | null>(null);
  const segmentElementsRef = useRef<ReadonlyMap<number, HTMLSpanElement>>(new Map());
  const segmentRefCallbacksRef = useRef<ReadonlyMap<number, RefCallback<HTMLSpanElement>>>(new Map());
  const { focusedIndex } = options;

  const focusSegment = useCallback((index: number) => {
    segmentElementsRef.current.get(index)?.focus({ preventScroll: true });
  }, []);

  // Goal: core가 포커스 칸을 옮기면(자동 이동·←→) DOM 포커스도 따라감. 필드 밖에 포커스가 있으면 빼앗지 않음
  useEffect(() => {
    if (focusedIndex === null || !rootRef.current?.contains(document.activeElement)) return;
    const target = segmentElementsRef.current.get(focusedIndex);
    if (target && document.activeElement !== target) target.focus({ preventScroll: true });
  }, [focusedIndex]);

  // Constraint: 네이티브 리스너는 칸마다 한 번만 붙이고 최신 상태는 ref로 읽음. ref 콜백이 매 렌더 바뀌면 리스너가 다시 붙음
  const segmentRefFor = useCallback(
    (index: number): RefCallback<HTMLSpanElement> => {
      const cached = segmentRefCallbacksRef.current.get(index);
      if (cached) return cached;
      const refCallback: RefCallback<HTMLSpanElement> = (element) => {
        if (!element) return;
        // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
        segmentElementsRef.current = new Map([...segmentElementsRef.current, [index, element]]);
        const release = bindSegmentElement(element, {
          sendCommands: (commands) => {
            for (const command of commands) latest.current.sendCommand(command);
          },
          readExpectedText: () => latest.current.describeSegment(index).displayText,
          isEditable: () => !latest.current.isDisabled && !latest.current.isReadOnly,
        });
        return () => {
          release();
          // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
          segmentElementsRef.current = new Map(
            [...segmentElementsRef.current].filter(([registeredIndex]) => registeredIndex !== index),
          );
        };
      };
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      segmentRefCallbacksRef.current = new Map([...segmentRefCallbacksRef.current, [index, refCallback]]);
      return refCallback;
    },
    [latest],
  );

  const rootRefCallback = useCallback<RefCallback<HTMLElement>>((element) => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    rootRef.current = element;
  }, []);

  const getSegmentProps = (index: number): SegmentElementProps => {
    const description = options.describeSegment(index);
    const isEditable = !options.isDisabled && !options.isReadOnly;
    const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
      const isRightToLeft = getComputedStyle(event.currentTarget).direction === 'rtl';
      const command = commandFromKey(event.key, {
        isRightToLeft,
        canToggleLeapMonth: description.canToggleLeapMonth,
      });
      if (command === null || !isEditable) return;
      event.preventDefault();
      options.sendCommand(command);
    };
    return {
      ref: segmentRefFor(index),
      role: 'spinbutton',
      contentEditable: isEditable,
      suppressContentEditableWarning: true,
      inputMode: 'numeric',
      enterKeyHint: 'next',
      spellCheck: false,
      autoCapitalize: 'off',
      tabIndex: options.isDisabled ? -1 : 0,
      'aria-label': description.label,
      'aria-valuemin': description.minValue,
      'aria-valuemax': description.maxValue,
      // Constraint: 붙여넣기 뒤 값이 칸 범위를 넘을 수 있음. 보조기술용 숫자는 범위 안으로 자르고 실제 글자는 aria-valuetext로 알림 (계약 §2.7 ①)
      'aria-valuenow': clampToSegmentRange(description),
      'aria-valuetext': description.valueText,
      'aria-invalid': options.isInvalid || undefined,
      'aria-readonly': options.isReadOnly || undefined,
      'aria-disabled': options.isDisabled || undefined,
      'aria-required': options.isRequired || undefined,
      onKeyDown,
      onFocus: () => options.sendCommand({ type: 'segment.focus', index }),
      onBlur: (event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!rootRef.current?.contains(nextFocus)) options.sendCommand({ type: 'segment.blur' });
      },
      // Constraint: 칸의 글자는 React 자식이 아니라 상태 기준 HTML로 고정. IME가 DOM을 먼저 바꿔도 React가 텍스트 노드를 잃지 않게 함
      dangerouslySetInnerHTML: { __html: escapeHtml(description.displayText) },
      ...partAttributes(options.segmentPart, {
        placeholder: description.isPlaceholder,
        focused: focusedIndex === index,
        invalid: options.isInvalid,
        disabled: options.isDisabled,
        readonly: options.isReadOnly,
      }),
    };
  };

  return { isFocusWithin: focusedIndex !== null, rootRef: rootRefCallback, focusSegment, getSegmentProps };
};

const bindSegmentElement = (element: HTMLElement, listeners: SegmentElementListeners): (() => void) => {
  const onBeforeInput = (event: InputEvent): void => {
    if (!event.cancelable) return;
    event.preventDefault();
    listeners.sendCommands(commandsFromInput(event.inputType, event.data));
  };
  // Constraint: 안드로이드 IME 조합 입력은 beforeinput을 취소할 수 없어 DOM이 먼저 바뀜. input에서 숫자를 반영하고 글자를 상태 기준으로 되돌림
  const onInput = (event: Event): void => {
    if (!(event instanceof InputEvent)) return;
    listeners.sendCommands(commandsFromInput(event.inputType, event.data));
    queueMicrotask(() => restoreText(element, listeners.readExpectedText()));
  };
  // Constraint: 편집할 수 없는 칸도 포커스를 받으면 paste 이벤트가 옴. 비활성·읽기 전용 값이 붙여넣기로 바뀌지 않게 막음
  const onPaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    if (!listeners.isEditable()) return;
    listeners.sendCommands([{ type: 'text.paste', text: readPastedText(event) }]);
  };
  element.addEventListener('beforeinput', onBeforeInput);
  element.addEventListener('input', onInput);
  element.addEventListener('paste', onPaste);
  return () => {
    element.removeEventListener('beforeinput', onBeforeInput);
    element.removeEventListener('input', onInput);
    element.removeEventListener('paste', onPaste);
  };
};

const clampToSegmentRange = ({ value, minValue, maxValue }: SegmentDescription): number | undefined =>
  value === null ? undefined : Math.min(Math.max(value, minValue), maxValue);

const restoreText = (element: HTMLElement, expectedText: string): void => {
  // 의도적 변경: IME가 바꾼 DOM 글자를 상태 기준으로 되돌리는 것이 목적임
  if (element.textContent !== expectedText) element.textContent = expectedText;
};
