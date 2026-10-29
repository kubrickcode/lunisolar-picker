import { type CalendarId, parseMonthCode } from '@lunisolar-picker/calendar';
import type { SecondaryDateLabel, VisibleMonth } from '../types';
import { defineLocale, type LocaleData } from './locale-data';

const LEAP_MONTH_PREFIX = '윤';
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);
const WEEKDAYS_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// Constraint: defineLocale 인자가 모듈 로드 시점에 이 함수를 읽으므로 export보다 먼저 선언해야 함
const formatSecondaryLabel = (label: SecondaryDateLabel): string => {
  if (!label.isFirstDayOfMonth) return String(label.day);
  return `${label.isLeapMonth ? LEAP_MONTH_PREFIX : ''}${parseMonthCode(label.monthCode).month}.${label.day}`;
};

export const ko: LocaleData = /* @__PURE__ */ defineLocale({
  id: 'ko',
  months: { long: MONTH_NUMBERS, short: MONTH_NUMBERS },
  weekdays: {
    narrow: ['일', '월', '화', '수', '목', '금', '토'],
    short: ['일', '월', '화', '수', '목', '금', '토'],
    long: WEEKDAYS_LONG,
  },
  field: {
    order: ['year', 'month', 'day'],
    separator: '. ',
    leapMonthPrefix: LEAP_MONTH_PREFIX,
    placeholder: { year: 'YYYY', month: 'MM', day: 'DD', hour: 'HH', minute: 'mm' },
  },
  weekStartsOn: 0,
  rangeSeparator: ' ~ ',
  formatHeading: (month, calendarId) => `${formatCalendarPrefix(calendarId)}${month.year}년 ${formatMonthName(month)}`,
  formatMonthName: (month) => formatMonthName(month),
  formatDayLabel: (fields, weekday, calendarId) =>
    `${formatCalendarPrefix(calendarId)}${fields.year}년 ${formatMonthName(fields)} ${fields.day}일 ${WEEKDAYS_LONG[weekday]}`,
  formatDateLabel: (fields) => `${fields.year}년 ${formatMonthName(fields)} ${fields.day}일`,
  formatSecondaryLabel,
  calendarNames: { gregory: '양력', dangi: '음력' },
  labels: {
    previousMonth: '이전 달',
    nextMonth: '다음 달',
    previousYear: '이전 해',
    nextYear: '다음 해',
    previousYears: '이전 연도',
    nextYears: '다음 연도',
    today: '오늘',
    clear: '지우기',
    confirm: '확인',
    cancel: '취소',
    close: '닫기',
    chooseDate: '날짜 선택',
    chooseDateRange: '기간 선택',
    chooseMonth: '월 선택',
    chooseTime: '시간 선택',
    year: '연도',
    month: '월',
    day: '일',
    hour: '시',
    minute: '분',
    leapMonth: '윤달',
    rangeStart: '시작일',
    rangeEnd: '종료일',
    formatRangeSummary: (startLabel, endLabel, dayCount) => `${startLabel}부터 ${endLabel}까지, ${dayCount}일`,
    formatRangeStartSelected: (startLabel) => `시작일 ${startLabel} 선택됨. 종료일을 고르세요.`,
    validation: {
      'invalid-date': '올바른 날짜가 아닙니다.',
      'invalid-time': '올바른 시간이 아닙니다.',
      incomplete: '끝까지 입력해 주세요.',
      'before-min': '선택할 수 있는 가장 이른 날짜보다 앞입니다.',
      'after-max': '선택할 수 있는 가장 늦은 날짜보다 뒤입니다.',
      'disabled-date': '선택할 수 없는 날짜입니다.',
      'outside-calendar-range': '지원하는 날짜 범위를 벗어났습니다.',
      'range-too-short': '선택한 기간이 너무 짧습니다.',
      'range-too-long': '선택한 기간이 너무 깁니다.',
      'range-includes-disabled': '기간 안에 선택할 수 없는 날짜가 있습니다.',
    },
  },
});

const formatMonthName = (month: VisibleMonth): string => {
  const { month: monthNumber, isLeapMonth } = parseMonthCode(month.monthCode);
  return `${isLeapMonth ? LEAP_MONTH_PREFIX : ''}${monthNumber}월`;
};

const formatCalendarPrefix = (calendarId: CalendarId): string => (calendarId === 'gregory' ? '' : '음력 ');
