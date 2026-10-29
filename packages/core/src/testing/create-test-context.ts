import { type EpochDay, epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { resolveConstraints } from '../constraints/resolve-constraints';
import type { PickerContext } from '../context';
import { ko } from '../locales/ko';

export const TEST_TODAY: EpochDay = epochDayFromCivil(2026, 10, 14);

export const createTestContext = (overrides: Partial<PickerContext> = {}): PickerContext => ({
  calendars: [gregory],
  constraints: resolveConstraints({}),
  today: TEST_TODAY,
  weekStartsOn: 0,
  locale: ko,
  commitMode: 'immediate',
  numberOfMonths: 1,
  ...overrides,
});
