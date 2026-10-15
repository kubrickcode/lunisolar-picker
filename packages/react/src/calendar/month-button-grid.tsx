import { type KeyboardEvent, type ReactElement, useState } from 'react';
import { type PartName, partAttributes, stateAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';

const HOME_INDEX = 0;

export type ButtonGridItem = {
  readonly accessibleName: string;
  readonly isDisabled: boolean;
  readonly isSelected: boolean;
  readonly key: string;
  readonly label: string;
  readonly onPick: () => void;
};

export type MonthButtonGridProps = {
  readonly columnCount: number;
  // Goal: 고른 뒤 이 격자가 새로 그려질 때(연 → 월) 키보드 포커스를 이어 받음. 달력 밖에서 쓰면 넘기지 않음
  readonly consumeFocusRequest?: (() => boolean) | undefined;
  // Constraint: 비활성 달력처럼 탭 정지점·키·고르기를 모두 멈춤 (M4 ruling: disabled 달력은 완전히 멈춤)
  readonly isDisabled?: boolean | undefined;
  readonly items: readonly ButtonGridItem[];
  readonly label: string;
  readonly part: PartName;
};

type KeyMoveInput = {
  readonly columnCount: number;
  readonly focusedIndex: number;
  readonly isRightToLeft: boolean;
  readonly itemCount: number;
  readonly key: string;
};

// Goal: 월·연 격자도 날짜 격자처럼 화살표로 이동하는 roving tabindex를 씀 (스펙 10.1)
export const MonthButtonGrid = ({
  columnCount,
  consumeFocusRequest,
  isDisabled = false,
  items,
  label,
  part,
}: MonthButtonGridProps): ReactElement => {
  const selectedIndex = Math.max(
    HOME_INDEX,
    items.findIndex((item) => item.isSelected),
  );
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);
  // Constraint: 연 쪽을 넘기면 지원 범위 끝 쪽은 항목이 적어질 수 있으므로 탭 정지점이 항목 밖에 남지 않게 자름
  const tabStopIndex = Math.min(focusedIndex, items.length - 1);
  const rows = Array.from({ length: Math.ceil(items.length / columnCount) }, (_, rowIndex) =>
    items.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount),
  );

  const moveFocus = (event: KeyboardEvent<HTMLTableElement>): void => {
    if (isDisabled) return;
    const nextIndex = nextIndexForKey({
      columnCount,
      focusedIndex: tabStopIndex,
      isRightToLeft: getComputedStyle(event.currentTarget).direction === 'rtl',
      itemCount: items.length,
      key: event.key,
    });
    if (nextIndex === null) return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[nextIndex]?.focus();
  };

  // Constraint: Biome의 role 규칙은 JSX에 직접 쓴 role만 보므로 날짜 격자처럼 role을 속성 객체로 펼침 (preflight 2.7)
  const gridProps = {
    role: 'grid',
    'aria-label': label,
    onKeyDown: moveFocus,
    ...partAttributes(part, { disabled: isDisabled }),
  };

  return (
    <table {...gridProps}>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={row[0]?.key ?? rowIndex}>
            {row.map((item, columnIndex) => {
              const index = rowIndex * columnCount + columnIndex;
              const isTabStop = index === tabStopIndex && !isDisabled;
              const isInert = item.isDisabled || isDisabled;
              const focusOnRequest = (element: HTMLButtonElement | null): void => {
                if (element && isTabStop && consumeFocusRequest?.()) element.focus();
              };
              const cellProps = {
                role: 'gridcell',
                'aria-selected': item.isSelected,
                ...stateAttributes({ selected: item.isSelected, disabled: isInert }),
              };
              return (
                <td key={item.key} {...cellProps}>
                  <button
                    ref={focusOnRequest}
                    type="button"
                    tabIndex={isTabStop ? 0 : -1}
                    aria-label={item.accessibleName}
                    {...(isTabStop ? { [AUTOFOCUS_ATTRIBUTE]: '' } : {})}
                    {...(isInert ? { 'aria-disabled': true } : {})}
                    onFocus={() => {
                      if (!isDisabled) setFocusedIndex(index);
                    }}
                    onClick={() => {
                      if (!isInert) item.onPick();
                    }}
                  >
                    {item.label}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const nextIndexForKey = ({ columnCount, focusedIndex, isRightToLeft, itemCount, key }: KeyMoveInput): number | null => {
  if (key === 'Home') return HOME_INDEX;
  if (key === 'End') return itemCount - 1;
  const horizontalStep = isRightToLeft ? -1 : 1;
  const offsetByKey: Readonly<Record<string, number>> = {
    ArrowRight: horizontalStep,
    ArrowLeft: -horizontalStep,
    ArrowDown: columnCount,
    ArrowUp: -columnCount,
  };
  const offset = offsetByKey[key];
  if (offset === undefined) return null;
  const nextIndex = focusedIndex + offset;
  return nextIndex < 0 || nextIndex >= itemCount ? null : nextIndex;
};
