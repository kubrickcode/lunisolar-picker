import { type CalendarId, parseMonthCode } from '@lunisolar-picker/calendar';
import type { SecondaryDateLabel, VisibleMonth } from '../types';
import { defineLocale, type LocaleData } from './locale-data';

const LEAP_MONTH_PREFIX = '閏';
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const WEEKDAYS_LONG = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

// Constraint: defineLocale 인자가 모듈 로드 시점에 이 함수를 읽으므로 export보다 먼저 선언해야 함
const formatSecondaryLabel = (label: SecondaryDateLabel): string => {
  if (!label.isFirstDayOfMonth) return String(label.day);
  return `${label.isLeapMonth ? LEAP_MONTH_PREFIX : ''}${parseMonthCode(label.monthCode).month}.${label.day}`;
};

export const ja: LocaleData = /* @__PURE__ */ defineLocale({
  id: 'ja',
  months: { long: MONTH_NUMBERS, short: MONTH_NUMBERS },
  weekdays: {
    narrow: ['日', '月', '火', '水', '木', '金', '土'],
    short: ['日', '月', '火', '水', '木', '金', '土'],
    long: WEEKDAYS_LONG,
  },
  field: {
    order: ['year', 'month', 'day'],
    separator: '/',
    leapMonthPrefix: LEAP_MONTH_PREFIX,
    placeholder: { year: 'YYYY', month: 'MM', day: 'DD', hour: 'HH', minute: 'mm' },
  },
  weekStartsOn: 0,
  rangeSeparator: '〜',
  formatHeading: (month, calendarId) => `${formatCalendarPrefix(calendarId)}${month.year}年${formatMonthName(month)}`,
  formatMonthName: (month) => formatMonthName(month),
  formatDayLabel: (fields, weekday, calendarId) =>
    `${formatCalendarPrefix(calendarId)}${fields.year}年${formatMonthName(fields)}${fields.day}日 ${WEEKDAYS_LONG[weekday]}`,
  formatDateLabel: (fields) => `${fields.year}年${formatMonthName(fields)}${fields.day}日`,
  formatSecondaryLabel,
  calendarNames: { gregory: '新暦', dangi: '旧暦' },
  labels: {
    previousMonth: '前の月',
    nextMonth: '次の月',
    previousYears: '前の年',
    nextYears: '次の年',
    today: '今日',
    clear: 'クリア',
    confirm: '適用',
    cancel: 'キャンセル',
    close: '閉じる',
    chooseDate: '日付を選択',
    chooseDateRange: '期間を選択',
    chooseMonth: '月を選択',
    chooseTime: '時刻を選択',
    year: '年',
    month: '月',
    day: '日',
    hour: '時',
    minute: '分',
    leapMonth: '閏月',
    rangeStart: '開始日',
    rangeEnd: '終了日',
    formatRangeSummary: (startLabel, endLabel, dayCount) => `${startLabel}から${endLabel}まで、${dayCount}日間`,
    formatRangeStartSelected: (startLabel) => `開始日 ${startLabel} を選択しました。終了日を選んでください。`,
    validation: {
      'invalid-date': '正しい日付を入力してください。',
      'invalid-time': '正しい時刻を入力してください。',
      incomplete: '最後まで入力してください。',
      'before-min': '選択できる最も早い日付より前です。',
      'after-max': '選択できる最も遅い日付より後です。',
      'disabled-date': 'この日付は選択できません。',
      'outside-calendar-range': '対応している範囲外の日付です。',
      'range-too-short': '選択した期間が短すぎます。',
      'range-too-long': '選択した期間が長すぎます。',
      'range-includes-disabled': '期間内に選択できない日付が含まれています。',
    },
  },
});

const formatMonthName = (month: VisibleMonth): string => {
  const { month: monthNumber, isLeapMonth } = parseMonthCode(month.monthCode);
  return `${isLeapMonth ? LEAP_MONTH_PREFIX : ''}${monthNumber}月`;
};

const formatCalendarPrefix = (calendarId: CalendarId): string => (calendarId === 'gregory' ? '' : '旧暦 ');
