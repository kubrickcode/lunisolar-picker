import type { DateRangeValue } from '@lunisolar-picker/calendar';
import { useState } from 'react';
import { MyDateRangePicker } from '../recipes/MyDateRangePicker';
import { DemoProvider } from './DemoProvider';

export function CustomRangePickerDemo() {
  const [range, setRange] = useState<DateRangeValue | null>(null);
  return (
    <DemoProvider>
      <MyDateRangePicker label="Stay" value={range} onValueChange={(next) => setRange(next)} maxDays={30} />
      <output>value: {JSON.stringify(range)}</output>
    </DemoProvider>
  );
}
