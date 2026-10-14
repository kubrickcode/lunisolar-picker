import { describe, expect, it } from 'vitest';
import { commandFromKey, commandsFromInput } from './segment-commands';

describe('commandsFromInput', () => {
  it('turns each typed digit into a digit command and separators into a separator command', () => {
    expect(commandsFromInput('insertText', '2.0')).toEqual([
      { type: 'digit.type', digit: 2 },
      { type: 'separator.type' },
      { type: 'digit.type', digit: 0 },
    ]);
  });

  it('reads digits from composition text that a virtual keyboard could not cancel', () => {
    expect(commandsFromInput('insertCompositionText', '7')).toEqual([{ type: 'digit.type', digit: 7 }]);
  });

  it('erases on deletion and ignores letters and formatting', () => {
    expect(commandsFromInput('deleteContentBackward', null)).toEqual([{ type: 'segment.erase' }]);
    expect(commandsFromInput('insertText', 'a')).toEqual([]);
    expect(commandsFromInput('formatBold', null)).toEqual([]);
  });

  it('leaves pasting to the paste listener', () => {
    expect(commandsFromInput('insertFromPaste', null)).toEqual([]);
  });
});

describe('commandFromKey', () => {
  const leftToRight = { isRightToLeft: false, canToggleLeapMonth: true };

  it.each([
    ['ArrowUp', { type: 'segment.step', amount: 1 }],
    ['ArrowDown', { type: 'segment.step', amount: -1 }],
    ['ArrowLeft', { type: 'focus.shift', amount: -1 }],
    ['ArrowRight', { type: 'focus.shift', amount: 1 }],
    ['Backspace', { type: 'segment.erase' }],
    ['L', { type: 'leapMonth.toggle' }],
  ])('maps %s', (key, expected) => {
    expect(commandFromKey(key, leftToRight)).toEqual(expected);
  });

  it('reverses horizontal arrows in right-to-left text', () => {
    expect(commandFromKey('ArrowLeft', { isRightToLeft: true, canToggleLeapMonth: false })).toEqual({
      type: 'focus.shift',
      amount: 1,
    });
  });

  it('reads the leap month key by its physical position when a Korean IME reports ㅣ', () => {
    expect(commandFromKey('ㅣ', { ...leftToRight, code: 'KeyL' })).toEqual({ type: 'leapMonth.toggle' });
  });

  it('leaves browser shortcuts such as Cmd+L and Ctrl+ArrowLeft to the browser', () => {
    expect(commandFromKey('l', { ...leftToRight, code: 'KeyL', hasShortcutModifier: true })).toBeNull();
    expect(commandFromKey('ArrowLeft', { ...leftToRight, hasShortcutModifier: true })).toBeNull();
  });

  it('ignores the leap month key where no leap month applies and lets Tab pass', () => {
    expect(commandFromKey('l', { isRightToLeft: false, canToggleLeapMonth: false })).toBeNull();
    expect(commandFromKey('Tab', leftToRight)).toBeNull();
  });
});
