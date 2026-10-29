import type { TimeString } from '@lunisolar-picker/calendar';
import { VALID } from '@lunisolar-picker/core';
import {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { partAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { mergeProps } from '../utilities/merge-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { parseWellFormedTime } from '../value/parse-controlled-value';
import { listTimes } from './list-times';

const DEFAULT_MINUTE_STEP = 30;
const FIRST_INDEX = 0;
const MISSING_INDEX = -1;

type KeyMoveInput = {
  readonly focusedIndex: number;
  readonly itemCount: number;
  readonly key: string;
};

type RovingState = {
  readonly focusedTime: TimeString | null;
  // Goal: 탭 정지점을 정할 때 본 선택 값. 선택이 바뀐 것을 알아채는 데 씀
  readonly selectedTime: TimeString | null;
};

export interface TimeListRootProps
  extends Omit<HTMLAttributes<HTMLUListElement>, 'children' | 'defaultValue' | 'onChange'> {
  readonly 'aria-label': string;
  readonly defaultValue?: string | null | undefined;
  readonly isEndOfDayAllowed?: boolean | undefined;
  readonly minuteStep?: number | undefined;
  // Goal: 받아들인 사용자 고르기마다(이미 고른 시각을 다시 골라도) 알림. 완성형 picker가 닫을 때를 정함. onValueChange는 값이 바뀔 때만
  readonly onPick?: ((value: TimeString) => void) | undefined;
  readonly onValueChange?: ((value: TimeString, details: ValueChangeDetails) => void) | undefined;
  readonly value?: string | null | undefined;
}

// Goal: 편성표처럼 정해진 간격의 시각을 목록에서 고름. 기기 로케일과 무관하게 24시간제 값 문자열을 그대로 보임 (계약 §3.3 TimeField)
// Constraint: 콜백은 사용자 조작에만 호출 시점에 부르고, 부모가 거부하면 부모 값을 보임(달력과 같은 규칙). 허용되지 않은 24:00은 형식 오류가 아니라 고를 항목이 없는 값이라 아무것도 선택하지 않음
export const TimeListRoot = ({
  defaultValue,
  isEndOfDayAllowed = false,
  minuteStep = DEFAULT_MINUTE_STEP,
  onPick,
  onValueChange,
  value,
  ...domProps
}: TimeListRootProps): ReactElement => {
  const times = useMemo(() => listTimes(minuteStep, isEndOfDayAllowed), [minuteStep, isEndOfDayAllowed]);
  const [selectedTime, setSelectedTime] = useControllableState<TimeString | null>(
    value === undefined ? undefined : parseWellFormedTime(value).value,
    parseWellFormedTime(defaultValue).value,
    undefined,
  );
  const [storedRoving, setRoving] = useState<RovingState>({ focusedTime: selectedTime, selectedTime });
  // Constraint: 선택이 바뀌면(고르기, 부모의 새 값) 탭 정지점도 새 선택으로 옮김. 렌더 중 상태 갱신이라 StrictMode 이중 렌더에서도 같은 결과
  const roving =
    storedRoving.selectedTime === selectedTime ? storedRoving : { focusedTime: selectedTime, selectedTime };
  if (roving !== storedRoving) setRoving(roving);
  // Constraint: 간격에 맞지 않는 값(09:37)이나 목록에 없는 24:00이면 그 앞의 가장 가까운 시각에서 시작함
  const tabStopIndex = indexAtOrBefore(times, roving.focusedTime) ?? FIRST_INDEX;
  const selectedIndex = indexAtOrBefore(times, selectedTime) ?? FIRST_INDEX;
  const listRef = useRef<HTMLUListElement | null>(null);

  // Goal: 열릴 때와 부모가 값을 바꿀 때 선택한 시각이 목록 안에 보이게 함. 페이지는 움직이지 않도록 목록만 스크롤함. 그리기 전에 옮겨 맨 위가 잠깐 보이지 않게 함
  // Constraint: 이미 보이는 옵션(클릭으로 고른 옵션 등)이면 움직이지 않음
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.children[selectedIndex];
    if (list && option instanceof HTMLElement && !isFullyVisibleInList(list, option))
      scrollToCenterOfList(list, option);
  }, [selectedIndex]);

  const choose = (time: TimeString): void => {
    // Constraint: macOS Safari·Firefox는 클릭으로 포커스를 옮기지 않으므로 탭 정지점을 직접 옮김
    setRoving({ focusedTime: time, selectedTime });
    if (time !== selectedTime) {
      setSelectedTime(time);
      onValueChange?.(time, { validity: VALID });
    }
    onPick?.(time);
  };

  const moveFocus = (event: KeyboardEvent<HTMLUListElement>): void => {
    const focusedTime = times[tabStopIndex];
    if ((event.key === 'Enter' || event.key === ' ') && focusedTime !== undefined) {
      event.preventDefault();
      choose(focusedTime);
      return;
    }
    const nextIndex = nextIndexForKey({ focusedIndex: tabStopIndex, itemCount: times.length, key: event.key });
    const nextTime = nextIndex === null ? undefined : times[nextIndex];
    const nextOption = nextIndex === null ? null : event.currentTarget.children[nextIndex];
    if (nextTime === undefined || !(nextOption instanceof HTMLElement)) return;
    event.preventDefault();
    // Constraint: 문서에 포커스가 없으면 focus 이벤트가 오지 않으므로 옵션의 onFocus에만 기대지 않고 탭 정지점을 직접 옮김
    setRoving({ focusedTime: nextTime, selectedTime });
    nextOption.focus();
  };

  // Constraint: Biome의 role 규칙은 JSX에 직접 쓴 role만 보므로 달력 격자처럼 role을 속성 객체로 펼침 (preflight 2.7)
  const listProps = mergeProps(
    { role: 'listbox', ref: listRef, onKeyDown: moveFocus, ...partAttributes('time-list') },
    domProps,
  );

  return (
    <ul {...listProps}>
      {times.map((time, index) => {
        const isSelected = time === selectedTime;
        const isTabStop = index === tabStopIndex;
        const optionProps = {
          role: 'option',
          'aria-selected': isSelected,
          tabIndex: isTabStop ? 0 : -1,
          // Goal: Popover·Sheet가 열릴 때 선택한 시각(없으면 첫 시각)에 포커스가 가게 함 (스펙 10.4, preflight 3.3)
          ...(isTabStop ? { [AUTOFOCUS_ATTRIBUTE]: '' } : {}),
          onClick: () => choose(time),
          onFocus: () => setRoving({ focusedTime: time, selectedTime }),
          ...partAttributes('time-option', { selected: isSelected, focused: isTabStop }),
        };
        return (
          <li key={time} {...optionProps}>
            {time}
          </li>
        );
      })}
    </ul>
  );
};

// Constraint: times는 오름차순이고 "HH:MM" 고정 폭이라 문자열 비교가 시각 비교와 같음
const indexAtOrBefore = (times: readonly TimeString[], time: TimeString | null): number | null => {
  if (time === null) return null;
  const index = times.reduce(
    (found, candidate, candidateIndex) => (candidate <= time ? candidateIndex : found),
    MISSING_INDEX,
  );
  return index === MISSING_INDEX ? null : index;
};

const isFullyVisibleInList = (list: HTMLElement, option: HTMLElement): boolean => {
  const listRect = list.getBoundingClientRect();
  const optionRect = option.getBoundingClientRect();
  return (
    optionRect.top >= listRect.top + list.clientTop &&
    optionRect.bottom <= listRect.top + list.clientTop + list.clientHeight
  );
};

const nextIndexForKey = ({ focusedIndex, itemCount, key }: KeyMoveInput): number | null => {
  if (key === 'Home') return FIRST_INDEX;
  if (key === 'End') return itemCount - 1;
  const offsetByKey: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
  const offset = offsetByKey[key];
  if (offset === undefined) return null;
  const nextIndex = focusedIndex + offset;
  return nextIndex < FIRST_INDEX || nextIndex >= itemCount ? null : nextIndex;
};

const scrollToCenterOfList = (list: HTMLElement, option: HTMLElement): void => {
  const listTop = list.getBoundingClientRect().top + list.clientTop;
  const optionRect = option.getBoundingClientRect();
  list.scrollBy({ top: optionRect.top - listTop - (list.clientHeight - optionRect.height) / 2 });
};
