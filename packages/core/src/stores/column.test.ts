import { describe, expect, it } from 'vitest';
import { type ColumnOption, columnReducer, createColumnState, selectedColumnValue } from './column';

const options = (values: readonly number[], disabledValues: readonly number[] = []): ColumnOption<number>[] =>
  values.map((value) => ({ isDisabled: disabledValues.includes(value), label: String(value), value }));

const reduceColumn = columnReducer<number>();

describe('column', () => {
  it('selects the given value and falls back to the first enabled option', () => {
    expect(selectedColumnValue(createColumnState(options([1, 2, 3]), 2))).toBe(2);
    expect(selectedColumnValue(createColumnState(options([1, 2, 3], [1]), 9))).toBe(2);
  });

  it('ignores a disabled option and keeps the state reference', () => {
    const state = createColumnState(options([1, 2, 3], [3]), 1);

    expect(reduceColumn(state, { index: 2, type: 'option.select' }, undefined)).toBe(state);
  });

  it('steps over disabled options and stops at the ends', () => {
    const state = createColumnState(options([1, 2, 3, 4], [2]), 1);

    const stepped = reduceColumn(state, { amount: 1, type: 'option.step' }, undefined);
    const atEnd = reduceColumn(stepped, { amount: 5, type: 'option.step' }, undefined);

    expect(selectedColumnValue(stepped)).toBe(3);
    expect(selectedColumnValue(atEnd)).toBe(4);
  });

  it('keeps the preferred value when options are replaced', () => {
    const state = createColumnState(options([28, 29, 30]), 29);

    const replaced = reduceColumn(
      state,
      { options: options([29, 30]), preferredValue: 29, type: 'options.replace' },
      undefined,
    );

    expect(selectedColumnValue(replaced)).toBe(29);
  });

  it('moves to the nearest enabled option when the preferred value disappears', () => {
    const state = createColumnState(options([28, 29, 30]), 30);

    const replaced = reduceColumn(
      state,
      { options: options([28, 29]), preferredValue: 30, type: 'options.replace' },
      undefined,
    );

    expect(selectedColumnValue(replaced)).toBe(29);
  });

  it('reports no value when every option is replaced away', () => {
    const state = createColumnState(options([1, 2]), 1);

    const replaced = reduceColumn(state, { options: [], preferredValue: 1, type: 'options.replace' }, undefined);

    expect(selectedColumnValue(replaced)).toBeNull();
  });
});
