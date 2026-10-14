import type { SegmentEvent } from '@lunisolar-picker/core';

const DELETE_INPUT_TYPES: ReadonlySet<string> = new Set([
  'deleteByCut',
  'deleteContentBackward',
  'deleteContentForward',
  'deleteWordBackward',
]);
const DIGIT_PATTERN = /^\d$/;
const SEPARATOR_CHARACTERS: ReadonlySet<string> = new Set(['.', '-', '/', ':', ' ', ',']);
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['insertCompositionText', 'insertReplacementText', 'insertText']);

// Constraint: core는 붙여넣기를 필드별 이벤트(DateFieldEvent·TimeFieldEvent)로 둠. 세그먼트 공통 이벤트가 아니라서 여기서 합침 (계약 §2.7)
export type SegmentCommand =
  | SegmentEvent
  | { readonly type: 'text.paste'; readonly text: string }
  | { readonly type: 'leapMonth.toggle' };

export type SegmentKeyOptions = {
  readonly canToggleLeapMonth: boolean;
  readonly isRightToLeft: boolean;
};

// Constraint: 붙여넣기는 contentEditable에서 beforeinput의 data가 비어 있으므로 paste 리스너가 clipboardData로 처리함
export const commandsFromInput = (inputType: string, data: string | null): readonly SegmentEvent[] => {
  if (DELETE_INPUT_TYPES.has(inputType)) return [{ type: 'segment.erase' }];
  if (!TEXT_INPUT_TYPES.has(inputType) || data === null) return [];
  return Array.from(data).flatMap(characterCommands);
};

export const commandFromKey = (key: string, options: SegmentKeyOptions): SegmentCommand | null => {
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
    case 'l':
    case 'L':
      return options.canToggleLeapMonth ? { type: 'leapMonth.toggle' } : null;
    default:
      return null;
  }
};

export const readPastedText = (event: ClipboardEvent): string => event.clipboardData?.getData('text/plain') ?? '';

const characterCommands = (character: string): SegmentEvent[] => {
  if (DIGIT_PATTERN.test(character)) return [{ type: 'digit.type', digit: Number(character) }];
  if (SEPARATOR_CHARACTERS.has(character)) return [{ type: 'separator.type' }];
  return [];
};
