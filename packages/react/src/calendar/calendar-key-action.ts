import type { NavigationEvent } from '@lunisolar-picker/core';

const SELECT_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

export type CalendarKeyAction =
  | { readonly kind: 'navigate'; readonly event: NavigationEvent }
  | { readonly kind: 'select' };

export type CalendarKeyInput = {
  readonly isRightToLeft: boolean;
  readonly isShiftPressed: boolean;
  readonly key: string;
};

// Constraint: WAI-ARIA APG Date Picker Grid 키 규칙 (스펙 10.1). Esc는 Popover·Sheet가 닫기로 처리하므로 여기서 잡지 않음
export const calendarKeyAction = ({
  isRightToLeft,
  isShiftPressed,
  key,
}: CalendarKeyInput): CalendarKeyAction | null => {
  if (SELECT_KEYS.has(key)) return { kind: 'select' };
  const forward = isRightToLeft ? -1 : 1;
  const pageUnit = isShiftPressed ? 'year' : 'month';
  switch (key) {
    case 'ArrowRight':
      return navigate({ type: 'focus.move', unit: 'day', amount: forward });
    case 'ArrowLeft':
      return navigate({ type: 'focus.move', unit: 'day', amount: -forward });
    case 'ArrowDown':
      return navigate({ type: 'focus.move', unit: 'week', amount: 1 });
    case 'ArrowUp':
      return navigate({ type: 'focus.move', unit: 'week', amount: -1 });
    case 'Home':
      return navigate({ type: 'focus.weekEdge', edge: 'start' });
    case 'End':
      return navigate({ type: 'focus.weekEdge', edge: 'end' });
    case 'PageDown':
      return navigate({ type: 'focus.move', unit: pageUnit, amount: 1 });
    case 'PageUp':
      return navigate({ type: 'focus.move', unit: pageUnit, amount: -1 });
    default:
      return null;
  }
};

const navigate = (event: NavigationEvent): CalendarKeyAction => ({ kind: 'navigate', event });
