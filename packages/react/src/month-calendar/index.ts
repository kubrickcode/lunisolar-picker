export type { MonthCalendarRootProps } from './month-calendar-root';
// Constraint: isolatedDeclarations에서 객체 리터럴 네임스페이스는 TS9013이므로 M3처럼 모듈 네임스페이스로 내보냄 (preflight 2.4)
export * as MonthCalendar from './parts';
export type { UseMonthCalendarProps } from './use-month-calendar';
