import { type CalendarId, parseMonthCode } from '@lunisolar-picker/calendar';
import type { SecondaryDateLabel, VisibleMonth } from '../types';
import { defineLocale, type LocaleData } from './locale-data';

const LEAP_MONTH_PREFIX = 'L';
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Constraint: defineLocale 인자가 모듈 로드 시점에 이 함수를 읽으므로 export보다 먼저 선언해야 함
const formatMonthName = (month: VisibleMonth, calendarId: CalendarId): string => {
  const { month: monthNumber, isLeapMonth } = parseMonthCode(month.monthCode);
  if (calendarId === 'gregory') return MONTHS_LONG[monthNumber - 1] ?? '';
  return `${isLeapMonth ? 'Leap' : 'Month'} ${monthNumber}`;
};

// Constraint: defineLocale 인자가 모듈 로드 시점에 이 함수를 읽으므로 export보다 먼저 선언해야 함
const formatSecondaryLabel = (label: SecondaryDateLabel): string => {
  if (!label.isFirstDayOfMonth) return String(label.day);
  return `${label.isLeapMonth ? LEAP_MONTH_PREFIX : ''}${parseMonthCode(label.monthCode).month}.${label.day}`;
};

export const en: LocaleData = /* @__PURE__ */ defineLocale({
  id: 'en',
  months: { long: MONTHS_LONG, short: MONTHS_SHORT },
  weekdays: {
    narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    long: WEEKDAYS_LONG,
  },
  field: {
    order: ['month', 'day', 'year'],
    separator: '/',
    leapMonthPrefix: LEAP_MONTH_PREFIX,
    placeholder: { year: 'YYYY', month: 'MM', day: 'DD', hour: 'HH', minute: 'mm' },
  },
  weekStartsOn: 0,
  rangeSeparator: ' – ',
  formatHeading: (month, calendarId) =>
    calendarId === 'gregory'
      ? `${formatMonthName(month, calendarId)} ${month.year}`
      : `${formatMonthName(month, calendarId)}, ${month.year} (Lunar)`,
  formatMonthName,
  formatDayLabel: (fields, weekday, calendarId) =>
    calendarId === 'gregory'
      ? `${WEEKDAYS_LONG[weekday]}, ${formatMonthName(fields, calendarId)} ${fields.day}, ${fields.year}`
      : `${WEEKDAYS_LONG[weekday]}, Lunar ${formatMonthName(fields, calendarId)} Day ${fields.day}, ${fields.year}`,
  formatDateLabel: (fields, calendarId) =>
    calendarId === 'gregory'
      ? `${formatMonthName(fields, calendarId)} ${fields.day}, ${fields.year}`
      : `${formatMonthName(fields, calendarId)} Day ${fields.day}, ${fields.year}`,
  formatSecondaryLabel,
  calendarNames: { gregory: 'Solar', dangi: 'Lunar' },
  labels: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    previousYears: 'Previous years',
    nextYears: 'Next years',
    today: 'Today',
    clear: 'Clear',
    confirm: 'Apply',
    cancel: 'Cancel',
    close: 'Close',
    chooseDate: 'Choose date',
    chooseDateRange: 'Choose date range',
    chooseMonth: 'Choose month',
    chooseTime: 'Choose time',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    hour: 'Hour',
    minute: 'Minute',
    leapMonth: 'Leap month',
    rangeStart: 'Start date',
    rangeEnd: 'End date',
    formatRangeSummary: (startLabel, endLabel, dayCount) =>
      `${startLabel} to ${endLabel}, ${dayCount} ${dayCount === 1 ? 'day' : 'days'}`,
    formatRangeStartSelected: (startLabel) => `Start date ${startLabel} selected. Choose an end date.`,
    validation: {
      'invalid-date': 'Enter a valid date.',
      'invalid-time': 'Enter a valid time.',
      incomplete: 'Finish entering the value.',
      'before-min': 'This date is before the earliest allowed date.',
      'after-max': 'This date is after the latest allowed date.',
      'disabled-date': 'This date is not available.',
      'outside-calendar-range': 'This date is outside the supported range.',
      'range-too-short': 'The selected range is too short.',
      'range-too-long': 'The selected range is too long.',
      'range-includes-disabled': 'The selected range includes unavailable dates.',
    },
  },
});
