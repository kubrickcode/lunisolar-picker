import { describe, expect, it } from 'vitest';
import { calendarKeyAction } from './calendar-key-action';

describe('calendarKeyAction', () => {
  it.each([
    ['ArrowRight', false, { type: 'focus.move', unit: 'day', amount: 1 }],
    ['ArrowLeft', false, { type: 'focus.move', unit: 'day', amount: -1 }],
    ['ArrowDown', false, { type: 'focus.move', unit: 'week', amount: 1 }],
    ['ArrowUp', false, { type: 'focus.move', unit: 'week', amount: -1 }],
    ['Home', false, { type: 'focus.weekEdge', edge: 'start' }],
    ['End', false, { type: 'focus.weekEdge', edge: 'end' }],
    ['PageDown', false, { type: 'focus.move', unit: 'month', amount: 1 }],
    ['PageUp', false, { type: 'focus.move', unit: 'month', amount: -1 }],
    ['PageDown', true, { type: 'focus.move', unit: 'year', amount: 1 }],
    ['PageUp', true, { type: 'focus.move', unit: 'year', amount: -1 }],
  ])('maps %s (shift: %s) to a navigation event', (key, isShiftPressed, event) => {
    expect(calendarKeyAction({ key, isShiftPressed, isRightToLeft: false })).toEqual({ kind: 'navigate', event });
  });

  it('flips horizontal arrows in right-to-left layouts', () => {
    expect(calendarKeyAction({ key: 'ArrowRight', isShiftPressed: false, isRightToLeft: true })).toEqual({
      kind: 'navigate',
      event: { type: 'focus.move', unit: 'day', amount: -1 },
    });
  });

  it.each(['Enter', ' '])('treats "%s" as selection', (key) => {
    expect(calendarKeyAction({ key, isShiftPressed: false, isRightToLeft: false })).toEqual({ kind: 'select' });
  });

  it.each(['Escape', 'Tab', 'a'])('leaves "%s" to the browser and surrounding parts', (key) => {
    expect(calendarKeyAction({ key, isShiftPressed: false, isRightToLeft: false })).toBeNull();
  });
});
