import {
  type CalendarId,
  type DateFields,
  LunisolarPickerError,
  VALIDATION_REASONS,
  type ValidationReason,
} from '@lunisolar-picker/calendar';
import type { DateSegmentKind, SecondaryDateLabel, TimeSegmentKind, VisibleMonth, Weekday } from '../types';

const DATE_SEGMENT_KINDS: readonly DateSegmentKind[] = ['year', 'month', 'day'];
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

export interface LocaleLabels {
  readonly cancel: string;
  readonly chooseDate: string;
  readonly chooseDateRange: string;
  readonly chooseMonth: string;
  readonly chooseTime: string;
  readonly clear: string;
  readonly close: string;
  readonly confirm: string;
  readonly day: string;
  readonly hour: string;
  readonly leapMonth: string;
  readonly minute: string;
  readonly month: string;
  readonly nextMonth: string;
  // Goal: 월 보기의 이전·다음 버튼처럼 한 해씩 옮기는 동작의 이름. nextYears는 연 쪽(여러 해)을 넘김
  readonly nextYear: string;
  readonly nextYears: string;
  readonly previousMonth: string;
  readonly previousYear: string;
  readonly previousYears: string;
  readonly rangeEnd: string;
  readonly rangeStart: string;
  readonly today: string;
  readonly validation: Readonly<Record<ValidationReason, string>>;
  readonly year: string;
  formatRangeStartSelected(startLabel: string): string;
  formatRangeSummary(startLabel: string, endLabel: string, dayCount: number): string;
}

export interface LocaleData {
  readonly calendarNames: Readonly<Record<CalendarId, string>>;
  readonly field: {
    readonly leapMonthPrefix: string;
    readonly order: readonly DateSegmentKind[];
    readonly placeholder: Readonly<Record<DateSegmentKind | TimeSegmentKind, string>>;
    readonly separator: string;
  };
  readonly id: string;
  readonly labels: LocaleLabels;
  readonly months: { readonly long: readonly string[]; readonly short: readonly string[] };
  readonly rangeSeparator: string;
  readonly weekdays: {
    readonly long: readonly string[];
    readonly narrow: readonly string[];
    readonly short: readonly string[];
  };
  readonly weekStartsOn: Weekday;
  formatDateLabel(fields: DateFields, calendarId: CalendarId): string;
  formatDayLabel(fields: DateFields, weekday: Weekday, calendarId: CalendarId): string;
  formatHeading(month: VisibleMonth, calendarId: CalendarId): string;
  formatMonthName(month: VisibleMonth, calendarId: CalendarId): string;
  formatSecondaryLabel(label: SecondaryDateLabel): string;
}

// Goal: 타입이 키를 강제하고, 배열 길이·세그먼트 순서·빈 문구처럼 타입이 못 잡는 실수는 정의 시점에 실패시킴
export const defineLocale = (locale: LocaleData): LocaleData => {
  const problems = [
    describeLengthProblem({ expectedLength: MONTHS_PER_YEAR, path: 'months.long', values: locale.months.long }),
    describeLengthProblem({ expectedLength: MONTHS_PER_YEAR, path: 'months.short', values: locale.months.short }),
    describeLengthProblem({ expectedLength: DAYS_PER_WEEK, path: 'weekdays.narrow', values: locale.weekdays.narrow }),
    describeLengthProblem({ expectedLength: DAYS_PER_WEEK, path: 'weekdays.short', values: locale.weekdays.short }),
    describeLengthProblem({ expectedLength: DAYS_PER_WEEK, path: 'weekdays.long', values: locale.weekdays.long }),
    isSegmentPermutation(locale.field.order) ? '' : 'field.order must contain year, month and day exactly once',
    ...VALIDATION_REASONS.filter((reason) => !locale.labels.validation[reason]).map(
      (reason) => `labels.validation.${reason} is empty`,
    ),
  ].filter((problem) => problem !== '');
  if (problems.length > 0) throw new LunisolarPickerError(`invalid locale "${locale.id}": ${problems.join('; ')}`);
  return locale;
};

const describeLengthProblem = ({
  expectedLength,
  path,
  values,
}: {
  expectedLength: number;
  path: string;
  values: readonly string[];
}): string =>
  values.length === expectedLength ? '' : `${path} must have ${expectedLength} entries, found ${values.length}`;

const isSegmentPermutation = (order: readonly DateSegmentKind[]): boolean =>
  order.length === DATE_SEGMENT_KINDS.length && DATE_SEGMENT_KINDS.every((kind) => order.includes(kind));
