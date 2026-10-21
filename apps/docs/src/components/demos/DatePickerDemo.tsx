import type { DateString } from '@lunisolar-picker/calendar';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function DatePickerDemo() {
  const [value, setValue] = useState<DateString | null>(null);
  return (
    <DemoProvider>
      <DatePicker aria-label="Date" value={value} onValueChange={(next) => setValue(next)} />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
