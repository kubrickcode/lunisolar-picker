import { type KeyboardEvent, type ReactElement, useState } from 'react';
import { type PartName, partAttributes, stateAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';
import { isRightToLeft } from '../utilities/is-right-to-left';

const HOME_INDEX = 0;

export type ButtonGridItem = {
  readonly accessibleName: string;
  readonly isDisabled: boolean;
  readonly isSelected: boolean;
  readonly key: string;
  readonly label: string;
  readonly onPick: () => void;
};

type KeyMoveInput = {
  readonly columnCount: number;
  readonly focusedIndex: number;
  readonly isRightToLeft: boolean;
  readonly itemCount: number;
  readonly key: string;
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

type RovingState = {
  readonly focusedKey: string | null;
  // Goal: 탭 정지점을 정할 때 본 선택 항목. 선택이 바뀐 것을 알아채는 데 씀
  readonly selectedKey: string | null;
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
  const selectedKey = items.find((item) => item.isSelected)?.key ?? null;
  const [storedRoving, setRoving] = useState<RovingState>({ focusedKey: selectedKey, selectedKey });
  // Constraint: 선택이 바뀌면(연 고르기, 윤달이 다른 해로 역법 전환) 탭 정지점도 새 선택으로 옮김. 렌더 중 상태 갱신이라 StrictMode 이중 렌더에서도 같은 결과
  const roving = storedRoving.selectedKey === selectedKey ? storedRoving : { focusedKey: selectedKey, selectedKey };
  if (roving !== storedRoving) setRoving(roving);
  // Constraint: 연 쪽을 넘기면 포커스했던 항목이 없을 수 있음(지원 범위 끝 쪽은 항목도 적음). 그때는 선택, 그것도 없으면 첫 항목
  const tabStopIndex = indexOfKey(items, roving.focusedKey) ?? indexOfKey(items, selectedKey) ?? HOME_INDEX;
  const focusItem = (index: number): void => {
    const key = items[index]?.key;
    if (key !== undefined) setRoving({ ...roving, focusedKey: key });
  };
  const rows = Array.from({ length: Math.ceil(items.length / columnCount) }, (_, rowIndex) =>
    items.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount),
  );

  const moveFocus = (event: KeyboardEvent<HTMLTableElement>): void => {
    if (isDisabled) return;
    const nextIndex = nextIndexForKey({
      columnCount,
      focusedIndex: tabStopIndex,
      isRightToLeft: isRightToLeft(event.currentTarget),
      itemCount: items.length,
      key: event.key,
    });
    if (nextIndex === null) return;
    event.preventDefault();
    focusItem(nextIndex);
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
                      if (!isDisabled) focusItem(index);
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

const indexOfKey = (items: readonly ButtonGridItem[], key: string | null): number | null => {
  const index = items.findIndex((item) => item.key === key);
  return index === -1 ? null : index;
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
