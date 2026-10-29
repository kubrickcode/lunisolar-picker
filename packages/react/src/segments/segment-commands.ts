import type { SegmentEvent } from '@lunisolar-picker/core';

const DELETE_INPUT_TYPES: ReadonlySet<string> = new Set([
  'deleteByCut',
  'deleteContentBackward',
  'deleteContentForward',
  'deleteWordBackward',
]);
const DIGIT_PATTERN = /^\d$/;
const LEAP_MONTH_KEY_CODE = 'KeyL';
const LEAP_MONTH_KEYS: ReadonlySet<string> = new Set(['L', 'l']);
const SEPARATOR_CHARACTERS: ReadonlySet<string> = new Set(['.', '-', '/', ':', ' ', ',']);
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['insertCompositionText', 'insertReplacementText', 'insertText']);

// Constraint: core는 붙여넣기를 필드별 이벤트(DateFieldEvent·TimeFieldEvent)로 둠. 세그먼트 공통 이벤트가 아니라서 여기서 합침 (계약 §2.7)
export type SegmentCommand =
  | SegmentEvent
  | { readonly type: 'text.paste'; readonly text: string }
  | { readonly type: 'leapMonth.toggle' };

export type SegmentKeyOptions = {
  readonly canToggleLeapMonth: boolean;
  // Goal: 한글 입력 상태에서는 L 자리 키의 key가 'ㅣ'라서 물리 키 위치(code)로도 윤달 단축키를 알아봄
  readonly code?: string | undefined;
  // Goal: Ctrl·Cmd·Alt 조합(주소창 이동 Cmd+L 등)은 브라우저 단축키라 가로채지 않음
  readonly hasShortcutModifier?: boolean | undefined;
  readonly isRightToLeft: boolean;
};

// Constraint: 붙여넣기는 contentEditable에서 beforeinput의 data가 비어 있으므로 paste 리스너가 clipboardData로 처리함
export const commandsFromInput = (inputType: string, data: string | null): readonly SegmentEvent[] => {
  if (DELETE_INPUT_TYPES.has(inputType)) return [{ type: 'segment.erase' }];
  if (!TEXT_INPUT_TYPES.has(inputType) || data === null) return [];
  return Array.from(data).flatMap(characterCommands);
};

export const commandFromKey = (key: string, options: SegmentKeyOptions): SegmentCommand | null => {
  if (options.hasShortcutModifier) return null;
  if (LEAP_MONTH_KEYS.has(key) || options.code === LEAP_MONTH_KEY_CODE) {
    return options.canToggleLeapMonth ? { type: 'leapMonth.toggle' } : null;
  }
  const backward = options.isRightToLeft ? 1 : -1;
  switch (key) {
    case 'ArrowUp':
      return { type: 'segment.step', amount: 1 };
    case 'ArrowDown':
      return { type: 'segment.step', amount: -1 };
    case 'ArrowLeft':
      return { type: 'focus.shift', amount: backward };
    case 'ArrowRight':
      return { type: 'focus.shift', amount: -backward };
    case 'Backspace':
    case 'Delete':
      return { type: 'segment.erase' };
    default:
      return null;
  }
};

// Goal: 읽기 전용이어도 칸 사이 이동은 허용하고 값을 바꾸는 명령만 막음
export const isNavigationCommand = (command: SegmentCommand): boolean => command.type === 'focus.shift';

export const readPastedText = (event: ClipboardEvent): string => event.clipboardData?.getData('text/plain') ?? '';

const characterCommands = (character: string): SegmentEvent[] => {
  if (DIGIT_PATTERN.test(character)) return [{ type: 'digit.type', digit: Number(character) }];
  if (SEPARATOR_CHARACTERS.has(character)) return [{ type: 'separator.type' }];
  return [];
};
