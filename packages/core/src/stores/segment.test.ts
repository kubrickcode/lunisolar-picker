import { describe, expect, it } from 'vitest';
import { canTakeAnotherDigit, createSegment, eraseDigit, stepSegment, typeDigit } from './segment';

const month = createSegment('month', { minValue: 1, maxValue: 12, maxDigits: 2 }, null);
const year = createSegment('year', { minValue: 1, maxValue: 9999, maxDigits: 4 }, null);

describe('segment editing', () => {
  it('waits for a second digit while another digit could still fit', () => {
    expect(typeDigit(month, 1)).toEqual({ segment: { ...month, typedText: '1', value: 1 }, shouldAdvance: false });
  });

  it('advances immediately when no second digit could fit', () => {
    expect(typeDigit(month, 3)).toEqual({ segment: { ...month, typedText: '3', value: 3 }, shouldAdvance: true });
  });

  it('starts over with the new digit when appending would exceed the maximum', () => {
    const typedOne = typeDigit(month, 1).segment;

    expect(typeDigit(typedOne, 5)).toEqual({ segment: { ...month, typedText: '5', value: 5 }, shouldAdvance: true });
  });

  it('accepts a leading zero and advances after the second digit', () => {
    const typedZero = typeDigit(month, 0);
    const typedNine = typeDigit(typedZero.segment, 9);

    expect(typedZero.shouldAdvance).toBe(false);
    expect(typedNine).toEqual({ segment: { ...month, typedText: '09', value: 9 }, shouldAdvance: true });
  });

  it('advances a year after four digits', () => {
    const typed = [1, 9, 9, 0].reduce((current, digit) => typeDigit(current.segment, digit), {
      segment: year,
      shouldAdvance: false,
    });

    expect(typed).toEqual({ segment: { ...year, typedText: '1990', value: 1990 }, shouldAdvance: true });
  });

  it('erases typed digits one at a time and then the value', () => {
    const typed = typeDigit(typeDigit(year, 1).segment, 9).segment;

    expect(eraseDigit(typed)).toMatchObject({ typedText: '1', value: 1 });
    expect(eraseDigit(createSegment('month', { minValue: 1, maxValue: 12, maxDigits: 2 }, 7))).toMatchObject({
      value: null,
    });
  });

  it('returns the same segment when there is nothing left to erase', () => {
    expect(eraseDigit(month)).toBe(month);
  });

  it('wraps stepping within the limits and starts from the given value when empty', () => {
    expect(stepSegment(createSegment('month', { minValue: 1, maxValue: 12, maxDigits: 2 }, 12), 1, 1).value).toBe(1);
    expect(stepSegment(month, -1, 10).value).toBe(10);
  });
});

describe('canTakeAnotherDigit', () => {
  it.each([
    ['an empty segment', '', true],
    ['a month digit that a second digit can follow', '1', true],
    ['a month digit that no second digit can follow', '3', false],
    ['a full two-digit month', '09', false],
  ])('answers for %s', (_, typedText, expected) => {
    expect(canTakeAnotherDigit({ ...month, typedText })).toBe(expected);
  });

  it('keeps room in a year until the fourth digit', () => {
    expect(canTakeAnotherDigit({ ...year, typedText: '199' })).toBe(true);
    expect(canTakeAnotherDigit({ ...year, typedText: '1990' })).toBe(false);
  });
});
