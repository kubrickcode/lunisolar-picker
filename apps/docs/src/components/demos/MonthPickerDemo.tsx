import type { MonthString } from '@lunisolar-picker/calendar';
import { MonthPicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function MonthPickerDemo() {
  const [value, setValue] = useState<MonthString | null>(null);
  return (
    <DemoProvider>
      <MonthPicker
        aria-label="Billing month"
        value={value}
        onValueChange={(next) => setValue(next)}
        min="2020-01"
        max="2030-12"
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
