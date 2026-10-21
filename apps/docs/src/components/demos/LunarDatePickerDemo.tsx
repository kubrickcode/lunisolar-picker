import { type DateString, parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const LUNAR_CALENDARS = [dangi];

function describeFields(value: DateString | null): string {
  if (value === null) return 'null';
  const parsed = parseDate(value, { calendars: LUNAR_CALENDARS });
  if (!parsed.isOk) return parsed.error;
  const { day, monthCode, year } = parsed.value;
  return JSON.stringify({ year, monthCode, day });
}

export function LunarDatePickerDemo() {
  const [value, setValue] = useState<DateString | null>('1990-06-23[u-ca=dangi]' as DateString);
  return (
    <DemoProvider locale={ko} calendars={LUNAR_CALENDARS}>
      <DatePicker aria-label="생년월일" value={value} onValueChange={(next) => setValue(next)} />
      <output>
        value: {JSON.stringify(value)} · fields: {describeFields(value)}
      </output>
    </DemoProvider>
  );
}
