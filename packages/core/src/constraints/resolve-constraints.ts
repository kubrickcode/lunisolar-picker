import {
  brandEpochDay,
  type CalendarSystem,
  type DateString,
  type EpochDay,
  formatDate,
  gregory,
  LunisolarPickerError,
  parseDate,
  type SupportedRange,
  type ValidationReason,
} from '@lunisolar-picker/calendar';

const DEFAULT_LIMIT_MODE: RangeLimitMode = 'block';

export type RangeLimitMode = 'block' | 'flag';

export interface DateConstraints {
  readonly min?: string;
  readonly max?: string;
  readonly isDateDisabled?: (date: DateString) => boolean;
}

export interface IgnoredConstraintInput {
  readonly field: 'min' | 'max';
  readonly input: string;
  readonly reason: ValidationReason;
}

export interface RangeConstraints extends DateConstraints {
  readonly minDays?: number;
  readonly maxDays?: number;
  readonly limitMode?: RangeLimitMode;
  readonly isOpenEndAllowed?: boolean;
}

export interface ResolvedConstraints {
  readonly minEpochDay: EpochDay;
  readonly maxEpochDay: EpochDay;
  readonly supportedRange: SupportedRange;
  readonly isEpochDayDisabled: (epochDay: EpochDay) => boolean;
  readonly minDays: number | null;
  readonly maxDays: number | null;
  readonly limitMode: RangeLimitMode;
  readonly isOpenEndAllowed: boolean;
  readonly ignoredInputs: readonly IgnoredConstraintInput[];
}

type BoundReading = {
  readonly epochDay: EpochDay | null;
  readonly ignored: IgnoredConstraintInput | null;
};

export const resolveConstraints = (
  constraints: RangeConstraints,
  displayCalendar: CalendarSystem = gregory,
  knownCalendars: readonly CalendarSystem[] = [displayCalendar],
): ResolvedConstraints => {
  assertDayCounts(constraints);
  const minReading = readBound({ field: 'min', input: constraints.min, knownCalendars });
  const maxReading = readBound({ field: 'max', input: constraints.max, knownCalendars });
  const supportedRange: SupportedRange = {
    min: brandEpochDay(Math.max(displayCalendar.supportedRange.min, gregory.supportedRange.min)),
    max: brandEpochDay(Math.min(displayCalendar.supportedRange.max, gregory.supportedRange.max)),
  };
  return {
    minEpochDay:
      minReading.epochDay === null
        ? supportedRange.min
        : brandEpochDay(Math.max(minReading.epochDay, supportedRange.min)),
    maxEpochDay:
      maxReading.epochDay === null
        ? supportedRange.max
        : brandEpochDay(Math.min(maxReading.epochDay, supportedRange.max)),
    supportedRange,
    isEpochDayDisabled: toEpochDayPredicate(constraints.isDateDisabled),
    minDays: constraints.minDays ?? null,
    maxDays: constraints.maxDays ?? null,
    limitMode: constraints.limitMode ?? DEFAULT_LIMIT_MODE,
    isOpenEndAllowed: constraints.isOpenEndAllowed ?? false,
    ignoredInputs: [minReading, maxReading].flatMap((reading) => (reading.ignored === null ? [] : [reading.ignored])),
  };
};

const assertDayCounts = (constraints: RangeConstraints): void => {
  for (const [name, value] of [
    ['minDays', constraints.minDays],
    ['maxDays', constraints.maxDays],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      throw new LunisolarPickerError(`${name} must be a positive integer, received ${value}`);
    }
  }
  const { minDays, maxDays } = constraints;
  if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
    throw new LunisolarPickerError(`minDays (${minDays}) cannot exceed maxDays (${maxDays})`);
  }
};

// Constraint: core는 콘솔을 쓰지 않으므로 해석에 실패한 경계는 버리고 ignoredInputs로 바인딩에 넘김
const readBound = (params: {
  readonly field: 'min' | 'max';
  readonly input: string | undefined;
  readonly knownCalendars: readonly CalendarSystem[];
}): BoundReading => {
  const { field, input, knownCalendars } = params;
  if (input === undefined) return { epochDay: null, ignored: null };
  const parsed = parseDate(input, { calendars: knownCalendars });
  if (parsed.isOk) return { epochDay: parsed.value.epochDay, ignored: null };
  return { epochDay: null, ignored: { field, input, reason: parsed.error } };
};

const toEpochDayPredicate = (
  isDateDisabled: ((date: DateString) => boolean) | undefined,
): ((epochDay: EpochDay) => boolean) => {
  if (!isDateDisabled) return () => false;
  return (epochDay) => {
    const date = formatDate(epochDay);
    return date.isOk && isDateDisabled(date.value);
  };
};
