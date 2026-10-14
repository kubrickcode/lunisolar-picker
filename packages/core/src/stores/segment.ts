export interface Segment<Kind extends string> extends SegmentLimits {
  readonly kind: Kind;
  readonly value: number | null;
  readonly typedText: string;
}

export type SegmentEvent =
  | { readonly type: 'segment.focus'; readonly index: number }
  | { readonly type: 'segment.blur' }
  | { readonly type: 'digit.type'; readonly digit: number }
  | { readonly type: 'separator.type' }
  | { readonly type: 'segment.erase' }
  | { readonly type: 'segment.step'; readonly amount: number }
  | { readonly type: 'focus.shift'; readonly amount: number };

export interface SegmentGroup<Kind extends string> {
  readonly segments: readonly Segment<Kind>[];
  readonly focusedIndex: number | null;
}

export interface SegmentLimits {
  readonly minValue: number;
  readonly maxValue: number;
  readonly maxDigits: number;
}

export interface TypedDigit<Kind extends string> {
  readonly segment: Segment<Kind>;
  readonly shouldAdvance: boolean;
}

export const createSegment = <Kind extends string>(
  kind: Kind,
  limits: SegmentLimits,
  value: number | null,
): Segment<Kind> => ({ kind, ...limits, value, typedText: '' });

export const eraseDigit = <Kind extends string>(segment: Segment<Kind>): Segment<Kind> => {
  if (segment.typedText === '') return segment.value === null ? segment : { ...segment, value: null };
  const typedText = segment.typedText.slice(0, -1);
  return { ...segment, typedText, value: typedText === '' ? null : Number(typedText) };
};

export const focusSegmentAt = <Kind extends string, Group extends SegmentGroup<Kind>>(
  group: Group,
  index: number | null,
): Group => {
  const focusedIndex = index === null ? null : Math.min(Math.max(index, 0), group.segments.length - 1);
  const hasTypedText = group.segments.some((segment) => segment.typedText !== '');
  if (focusedIndex === group.focusedIndex && !hasTypedText) return group;
  return { ...group, focusedIndex, segments: group.segments.map((segment) => ({ ...segment, typedText: '' })) };
};

// Goal: 날짜·시간 필드가 공유하는 키 입력 규칙을 한 곳에 둠. 칸 종류별 차이는 stepStartValue로만 받음
export const reduceSegmentEvent = <Kind extends string, Group extends SegmentGroup<Kind>>(
  group: Group,
  event: SegmentEvent,
  stepStartValue: (kind: Kind) => number,
): Group => {
  const focused = group.focusedIndex === null ? undefined : group.segments[group.focusedIndex];
  switch (event.type) {
    case 'segment.focus':
      return focusSegmentAt<Kind, Group>(group, event.index);
    case 'segment.blur':
      return focusSegmentAt<Kind, Group>(group, null);
    case 'focus.shift':
      return group.focusedIndex === null
        ? group
        : focusSegmentAt<Kind, Group>(group, group.focusedIndex + event.amount);
    case 'digit.type':
      return focused ? typeIntoGroup({ digit: event.digit, focused, group }) : group;
    case 'separator.type':
      return focused && focused.typedText !== '' && group.focusedIndex !== null
        ? focusSegmentAt<Kind, Group>(group, group.focusedIndex + 1)
        : group;
    case 'segment.erase':
      return focused ? replaceFocusedSegment(group, eraseDigit(focused)) : group;
    case 'segment.step':
      return focused
        ? replaceFocusedSegment(group, stepSegment(focused, event.amount, stepStartValue(focused.kind)))
        : group;
  }
};

export const replaceFocusedSegment = <Kind extends string, Group extends SegmentGroup<Kind>>(
  group: Group,
  segment: Segment<Kind>,
): Group => {
  if (group.focusedIndex === null || group.segments[group.focusedIndex] === segment) return group;
  const index = group.focusedIndex;
  return {
    ...group,
    segments: group.segments.map((current, currentIndex) => (currentIndex === index ? segment : current)),
  };
};

export const stepSegment = <Kind extends string>(
  segment: Segment<Kind>,
  amount: number,
  startValue: number,
): Segment<Kind> => {
  if (segment.value === null) return { ...segment, value: startValue, typedText: '' };
  const span = segment.maxValue - segment.minValue + 1;
  const offset = (((segment.value - segment.minValue + amount) % span) + span) % span;
  return { ...segment, value: segment.minValue + offset, typedText: '' };
};

// Goal: 다음 숫자가 들어갈 자리가 없으면 바로 다음 칸으로 넘김 (예: 월 칸에 3 → 03, 시 칸에 9 → 09)
export const typeDigit = <Kind extends string>(segment: Segment<Kind>, digit: number): TypedDigit<Kind> => {
  const appended = `${segment.typedText}${digit}`;
  const isOverflowing = appended.length > segment.maxDigits || Number(appended) > segment.maxValue;
  const typedText = isOverflowing ? String(digit) : appended;
  const canTakeAnotherDigit = typedText.length < segment.maxDigits && Number(`${typedText}0`) <= segment.maxValue;
  return { segment: { ...segment, typedText, value: Number(typedText) }, shouldAdvance: !canTakeAnotherDigit };
};

export const withSegmentValue = <Kind extends string>(segment: Segment<Kind>, value: number | null): Segment<Kind> => ({
  ...segment,
  value,
  typedText: '',
});

const typeIntoGroup = <Kind extends string, Group extends SegmentGroup<Kind>>({
  digit,
  focused,
  group,
}: {
  readonly digit: number;
  readonly focused: Segment<Kind>;
  readonly group: Group;
}): Group => {
  const { segment, shouldAdvance } = typeDigit(focused, digit);
  const replaced = replaceFocusedSegment(group, segment);
  const isLastSegment = group.focusedIndex === group.segments.length - 1;
  if (!shouldAdvance || isLastSegment || group.focusedIndex === null) return replaced;
  return { ...replaced, focusedIndex: group.focusedIndex + 1 };
};
