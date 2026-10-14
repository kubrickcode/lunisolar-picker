import { formatTime, parseTime, type TimeString } from '@lunisolar-picker/calendar';
import type { Reducer } from '../create-store';
import { invalidBecause, type TimeSegmentKind, VALID, type Validity } from '../types';
import {
  createSegment,
  reduceSegmentEvent,
  replaceFocusedSegment,
  type SegmentEvent,
  type SegmentGroup,
  withSegmentValue,
} from './segment';
import { assertMinuteStep, END_OF_DAY_HOUR, LAST_HOUR, MINUTES_PER_HOUR, TIME_PART_DIGITS } from './time-constants';

const COMPACT_TIME_LENGTH = 4;

export interface TimeFieldContext {
  readonly minuteStep: number;
  readonly isEndOfDayAllowed: boolean;
}

export type TimeFieldEvent =
  | SegmentEvent
  | { readonly type: 'text.paste'; readonly text: string }
  | { readonly type: 'value.sync'; readonly time: TimeString | null };

export interface TimeFieldResult {
  readonly time: TimeString | null;
  readonly validity: Validity;
}

type TimeFieldScope = {
  readonly context: TimeFieldContext;
  readonly state: TimeFieldState;
};

export interface TimeFieldState extends SegmentGroup<TimeSegmentKind> {}

export const createTimeFieldState = (initial: TimeString | null, context: TimeFieldContext): TimeFieldState => {
  assertMinuteStep(context.minuteStep);
  const parsed = initial === null ? null : parseTime(initial, { isEndOfDayAllowed: context.isEndOfDayAllowed });
  const time = parsed?.isOk ? parsed.value : null;
  return {
    focusedIndex: null,
    segments: [
      createSegment(
        'hour',
        { minValue: 0, maxValue: context.isEndOfDayAllowed ? END_OF_DAY_HOUR : LAST_HOUR, maxDigits: TIME_PART_DIGITS },
        time?.hour ?? null,
      ),
      createSegment(
        'minute',
        { minValue: 0, maxValue: MINUTES_PER_HOUR - 1, maxDigits: TIME_PART_DIGITS },
        time?.minute ?? null,
      ),
    ],
  };
};

export const timeFieldReducer: Reducer<TimeFieldState, TimeFieldEvent, TimeFieldContext> = (state, event, context) => {
  switch (event.type) {
    case 'text.paste':
      return pasteTime(state, event.text);
    case 'value.sync':
      return syncTime({ context, state }, event.time);
    case 'segment.step':
      return stepTimeSegment({ context, state }, event.amount);
    default:
      return reduceSegmentEvent<TimeSegmentKind, TimeFieldState>(state, event, () => 0);
  }
};

export const timeFieldResult = (state: TimeFieldState, context: TimeFieldContext): TimeFieldResult => {
  const [hour = null, minute = null] = state.segments.map((segment) => segment.value);
  if (hour === null && minute === null) return { time: null, validity: VALID };
  if (hour === null || minute === null) return { time: null, validity: invalidBecause(['incomplete']) };
  const time = formatTime(hour, minute, { isEndOfDayAllowed: context.isEndOfDayAllowed });
  return time.isOk ? { time: time.value, validity: VALID } : { time: null, validity: invalidBecause([time.error]) };
};

const pasteTime = (state: TimeFieldState, text: string): TimeFieldState => {
  const digitGroups = text.match(/\d+/g) ?? [];
  const [firstGroup, secondGroup] = digitGroups;
  const isCompact = digitGroups.length === 1 && firstGroup?.length === COMPACT_TIME_LENGTH;
  const hourText = isCompact ? firstGroup?.slice(0, TIME_PART_DIGITS) : firstGroup;
  const minuteText = isCompact ? firstGroup?.slice(TIME_PART_DIGITS) : secondGroup;
  if (hourText === undefined || minuteText === undefined || (!isCompact && digitGroups.length !== 2)) return state;
  const [hourSegment, minuteSegment] = state.segments;
  if (!hourSegment || !minuteSegment) return state;
  return {
    ...state,
    segments: [withSegmentValue(hourSegment, Number(hourText)), withSegmentValue(minuteSegment, Number(minuteText))],
  };
};

// Goal: 같은 값을 다시 동기화하면 같은 상태를 돌려줘 store 구독자가 다시 그리지 않게 함
const syncTime = ({ context, state }: TimeFieldScope, time: TimeString | null): TimeFieldState => {
  const synced = createTimeFieldState(time, context);
  const isUnchanged = synced.segments.every(
    (segment, index) =>
      segment.value === state.segments[index]?.value && segment.maxValue === state.segments[index]?.maxValue,
  );
  return isUnchanged ? state : { ...synced, focusedIndex: state.focusedIndex };
};

// Goal: 분 칸 ↑↓는 간격 배수로 맞춤 (07에서 5분 간격 ↑ → 10, ↓ → 05). web-console TimeSelector의 5분 단위를 대체
const stepTimeSegment = ({ context, state }: TimeFieldScope, amount: number): TimeFieldState => {
  const focused = state.focusedIndex === null ? undefined : state.segments[state.focusedIndex];
  if (focused?.kind !== 'minute' || focused.value === null) {
    return reduceSegmentEvent<TimeSegmentKind, TimeFieldState>(state, { type: 'segment.step', amount }, () => 0);
  }
  const step = context.minuteStep;
  const alignedBase = amount > 0 ? Math.floor(focused.value / step) * step : Math.ceil(focused.value / step) * step;
  const minute = (((alignedBase + amount * step) % MINUTES_PER_HOUR) + MINUTES_PER_HOUR) % MINUTES_PER_HOUR;
  return replaceFocusedSegment(state, withSegmentValue(focused, minute));
};
