import type { DateString } from '@lunisolar-picker/calendar';
import { Calendar } from '@lunisolar-picker/react';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

// Goal: 공휴일 데이터는 앱 몫이고 라이브러리는 칸 렌더링 슬롯만 준다는 경계를 보여 줌 (스펙 1.3)
const HOLIDAY_NAMES: Readonly<Record<string, string>> = {
  '2026-10-03': 'National Foundation Day',
  '2026-10-09': 'Hangul Day',
  '2026-12-25': 'Christmas Day',
};

export function HolidayCalendarDemo() {
  const [value, setValue] = useState<DateString | null>('2026-10-14' as DateString);
  return (
    <DemoProvider>
      <Calendar.Root
        aria-label="Holiday calendar"
        value={value}
        onValueChange={(next) => setValue(next)}
        getCellLabel={(cell) => HOLIDAY_NAMES[cell.date]}
      >
        <Calendar.Header>
          <Calendar.PrevButton />
          <Calendar.Heading />
          <Calendar.NextButton />
        </Calendar.Header>
        <Calendar.Grid monthIndex={0}>
          {(cell) => (
            <Calendar.Cell key={cell.epochDay} cell={cell}>
              {(info) => (
                <>
                  <span>{info.day}</span>
                  {HOLIDAY_NAMES[info.date] && <span className="holiday-dot" aria-hidden="true" />}
                </>
              )}
            </Calendar.Cell>
          )}
        </Calendar.Grid>
      </Calendar.Root>
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
