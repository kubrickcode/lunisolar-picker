import type { Reducer } from '../create-store';

export interface ColumnOption<Value> {
  readonly isDisabled: boolean;
  readonly label: string;
  readonly value: Value;
}

export interface ColumnState<Value> {
  readonly options: readonly ColumnOption<Value>[];
  readonly selectedIndex: number;
}

export type ColumnEvent<Value> =
  | { readonly index: number; readonly type: 'option.select' }
  | { readonly amount: number; readonly type: 'option.step' }
  | {
      readonly options: readonly ColumnOption<Value>[];
      readonly preferredValue: Value;
      readonly type: 'options.replace';
    };

type IsEqual<Value> = (first: Value, second: Value) => boolean;

type NextEnabledIndexOptions<Value> = {
  readonly direction: 1 | -1;
  readonly from: number;
  readonly options: readonly ColumnOption<Value>[];
};

type ReplaceOptionsOptions<Value> = {
  readonly isEqual: IsEqual<Value>;
  readonly options: readonly ColumnOption<Value>[];
  readonly preferredValue: Value;
  readonly state: ColumnState<Value>;
};

export const createColumnState = <Value>(
  options: readonly ColumnOption<Value>[],
  selectedValue: Value,
  isEqual: IsEqual<Value> = Object.is,
): ColumnState<Value> => {
  const preferredIndex = options.findIndex((option) => isEqual(option.value, selectedValue));
  return { options, selectedIndex: nearestEnabledIndex(options, preferredIndex === -1 ? 0 : preferredIndex) };
};

export const columnReducer =
  <Value>(isEqual: IsEqual<Value> = Object.is): Reducer<ColumnState<Value>, ColumnEvent<Value>, void> =>
  (state, event) => {
    switch (event.type) {
      case 'option.select':
        return state.options[event.index]?.isDisabled === false && event.index !== state.selectedIndex
          ? { ...state, selectedIndex: event.index }
          : state;
      case 'option.step':
        return withSelectedIndex(state, steppedIndex(state, event.amount));
      case 'options.replace':
        return replaceOptions({ isEqual, options: event.options, preferredValue: event.preferredValue, state });
    }
  };

export const selectedColumnValue = <Value>(state: ColumnState<Value>): Value | null =>
  state.options[state.selectedIndex]?.value ?? null;

const withSelectedIndex = <Value>(state: ColumnState<Value>, selectedIndex: number): ColumnState<Value> =>
  selectedIndex === state.selectedIndex ? state : { ...state, selectedIndex };

const steppedIndex = <Value>(state: ColumnState<Value>, amount: number): number => {
  const direction = amount < 0 ? -1 : 1;
  let index = state.selectedIndex;
  for (let remaining = Math.abs(amount); remaining > 0; remaining -= 1) {
    const next = nextEnabledIndex({ direction, from: index, options: state.options });
    if (next === null) break;
    index = next;
  }
  return index;
};

const nextEnabledIndex = <Value>({ direction, from, options }: NextEnabledIndexOptions<Value>): number | null => {
  for (let index = from + direction; index >= 0 && index < options.length; index += direction) {
    if (options[index]?.isDisabled === false) return index;
  }
  return null;
};

// Goal: 연·월이 바뀌어 고른 값(예: 30일·윤달)이 사라지면 같은 자리에서 가장 가까운 선택 가능 항목으로 옮김
const nearestEnabledIndex = <Value>(options: readonly ColumnOption<Value>[], preferredIndex: number): number => {
  const clampedIndex = Math.min(Math.max(preferredIndex, 0), Math.max(options.length - 1, 0));
  for (let distance = 0; distance < options.length; distance += 1) {
    if (options[clampedIndex - distance]?.isDisabled === false) return clampedIndex - distance;
    if (options[clampedIndex + distance]?.isDisabled === false) return clampedIndex + distance;
  }
  return clampedIndex;
};

const replaceOptions = <Value>({
  isEqual,
  options,
  preferredValue,
  state,
}: ReplaceOptionsOptions<Value>): ColumnState<Value> => {
  const preferredIndex = options.findIndex((option) => isEqual(option.value, preferredValue));
  return {
    options,
    selectedIndex: nearestEnabledIndex(options, preferredIndex === -1 ? state.selectedIndex : preferredIndex),
  };
};
