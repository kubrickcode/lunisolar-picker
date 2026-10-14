import { type CalendarId, type CalendarSystem, type EpochDay, gregory } from '@lunisolar-picker/calendar';
import {
  buildMonthGrid,
  type CommitMode,
  createNavigationState,
  findCalendar,
  firstEpochDayOfMonth,
  type MonthGrid,
  type MonthGridCell,
  type NavigationEvent,
  type NavigationState,
  navigationReducer,
  type PickerContext,
  type RangeConstraints,
  type SelectedDay,
  shiftVisibleMonth,
} from '@lunisolar-picker/core';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SharedPickerProps } from '../settings/shared-picker-props';
import { usePickerContext } from '../settings/use-picker-context';
import type { PickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { isCalendarProvided, providedCalendarOf } from './provided-calendar';

const DEFAULT_COMMIT_MODE: CommitMode = 'immediate';
const DEFAULT_NUMBER_OF_MONTHS = 1;

export type CalendarFoundation = {
  readonly calendar: CalendarSystem;
  readonly consumeFocusRequest: () => boolean;
  readonly context: PickerContext;
  readonly idPrefix: string;
  readonly months: readonly MonthGrid[];
  readonly navigation: NavigationState;
  readonly requestFocus: () => void;
  readonly secondaryCalendar: CalendarSystem | null;
  readonly selectDisplayCalendar: (calendarId: CalendarId) => void;
  readonly sendNavigation: (event: NavigationEvent) => void;
  readonly settings: PickerSettings;
  readonly slideDirection: SlideDirection | null;
};

export type CalendarFoundationInput = {
  readonly constraints: RangeConstraints;
  // Goal: 처음 포커스할 날과 처음 보여 줄 역법의 근거. 값이 없으면 null (범위 달력은 시작일)
  readonly initialSelected: SelectedDay | null;
  readonly props: CalendarFoundationProps;
  readonly settings: PickerSettings;
};

export type CalendarFoundationProps = SharedPickerProps & {
  readonly commitMode?: CommitMode | undefined;
  readonly defaultDisplayCalendar?: CalendarId | undefined;
  readonly displayCalendar?: CalendarId | undefined;
  readonly getCellLabel?: ((cell: MonthGridCell) => string | undefined) | undefined;
  readonly numberOfMonths?: number | undefined;
  readonly onDisplayCalendarChange?: ((calendarId: CalendarId) => void) | undefined;
};

export type SlideDirection = 'previous' | 'next';

type SlideState = {
  readonly direction: SlideDirection | null;
  readonly monthStartEpochDay: EpochDay;
};

// Goal: 단일·범위 달력이 공유하는 역법·제약·navigation·월 격자·포커스 요청. 두 Root는 선택 store만 바꿔 얹음
// Constraint: 표시 역법의 단일 출처는 navigation store. 제어형 displayCalendar는 store로 밀어 넣고, 부모가 사용자의 전환을 거부하면 부모 값으로 되돌림(값과 같은 달력 정책)
export const useCalendarFoundation = ({
  constraints,
  initialSelected,
  props,
  settings,
}: CalendarFoundationInput): CalendarFoundation => {
  const idPrefix = useId();
  const { calendars } = settings;
  const context = usePickerContext(settings, {
    constraints,
    commitMode: props.commitMode ?? DEFAULT_COMMIT_MODE,
    numberOfMonths: props.numberOfMonths ?? DEFAULT_NUMBER_OF_MONTHS,
  });
  // Constraint: navigationReducer는 모든 이벤트에서 지금 표시 역법을 찾으므로, 앱이 그 역법을 calendars에서 빼면 이벤트(calendar.set 포함)를 보낼 수 없음. 역법 구성이 바뀌면 store를 다시 만들어 양력으로 옮김 (preflight 3.5)
  const { state: navigation, send: sendNavigation } = useStoreInstance(
    (previous: NavigationState | undefined) =>
      previous === undefined
        ? createNavigationState(context, {
            focusedEpochDay: initialSelected?.epochDay ?? context.today,
            // Constraint: 표시 역법 prop이 없으면 값의 역법으로 엶. 입력 칸의 "값의 역법이 이긴다"와 같은 규칙 (preflight 3.11)
            displayCalendarId: providedCalendarOf(
              calendars,
              props.displayCalendar ?? props.defaultDisplayCalendar ?? initialSelected?.calendarId ?? gregory.id,
            ).id,
          })
        : moveOffRemovedCalendar(previous, context),
    navigationReducer,
    context,
    { resetKey: settings.calendarKey },
  );
  const calendar = providedCalendarOf(calendars, navigation.displayCalendarId);
  const secondaryCalendar = pickSecondaryCalendar(calendars, calendar);

  const requestedCalendarId = props.displayCalendar;
  useEffect(() => {
    if (requestedCalendarId === undefined || requestedCalendarId === navigation.displayCalendarId) return;
    if (!isCalendarProvided(calendars, requestedCalendarId)) return;
    sendNavigation({ type: 'calendar.set', calendarId: requestedCalendarId });
  }, [requestedCalendarId, navigation.displayCalendarId, calendars, sendNavigation]);

  const months = useMemo(
    () =>
      Array.from({ length: context.numberOfMonths }, (_, index) =>
        buildMonthGrid({
          calendar,
          month: shiftVisibleMonth(calendar, navigation.visibleMonth, index),
          weekStartsOn: context.weekStartsOn,
          secondaryCalendar,
        }),
      ),
    [calendar, secondaryCalendar, navigation.visibleMonth, context.numberOfMonths, context.weekStartsOn],
  );
  const slideDirection = useSlideDirection(firstEpochDayOfMonth(calendar, navigation.visibleMonth));

  const isFocusRequestedRef = useRef(false);
  const requestFocus = useCallback(() => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isFocusRequestedRef.current = true;
  }, []);
  const consumeFocusRequest = useCallback(() => {
    const isRequested = isFocusRequestedRef.current;
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    isFocusRequestedRef.current = false;
    return isRequested;
  }, []);

  const selectDisplayCalendar = (calendarId: CalendarId): void => {
    if (calendarId === navigation.displayCalendarId) return;
    // Constraint: 모르는 역법 id는 다음 렌더가 아니라 호출한 곳에서 LunisolarPickerError로 드러나게 함
    findCalendar(calendars, calendarId);
    sendNavigation({ type: 'calendar.set', calendarId });
    props.onDisplayCalendarChange?.(calendarId);
  };

  return {
    calendar,
    consumeFocusRequest,
    context,
    idPrefix,
    months,
    navigation,
    requestFocus,
    secondaryCalendar,
    selectDisplayCalendar,
    sendNavigation,
    settings,
    slideDirection,
  };
};

// Constraint: 같은 날을 양력으로 보여 줌. 포커스한 날은 epochDay라 그대로 둘 수 있음. 앱이 고른 것이 아니므로 onDisplayCalendarChange는 부르지 않음
const moveOffRemovedCalendar = (previous: NavigationState, context: PickerContext): NavigationState =>
  isCalendarProvided(context.calendars, previous.displayCalendarId)
    ? previous
    : createNavigationState(context, { focusedEpochDay: previous.focusedEpochDay, displayCalendarId: gregory.id });

const pickSecondaryCalendar = (
  calendars: readonly CalendarSystem[],
  displayed: CalendarSystem,
): CalendarSystem | null => calendars.find((candidate) => candidate.id !== displayed.id) ?? null;

// Goal: 보이는 첫 달의 시작일이 바뀐 방향으로 넘김 애니메이션을 고름. 렌더 중 상태 갱신이라 StrictMode 이중 렌더에서도 같은 결과
const useSlideDirection = (monthStartEpochDay: EpochDay): SlideDirection | null => {
  const [slide, setSlide] = useState<SlideState>({ direction: null, monthStartEpochDay });
  if (slide.monthStartEpochDay === monthStartEpochDay) return slide.direction;
  const next: SlideState = {
    direction: monthStartEpochDay > slide.monthStartEpochDay ? 'next' : 'previous',
    monthStartEpochDay,
  };
  setSlide(next);
  return next.direction;
};
