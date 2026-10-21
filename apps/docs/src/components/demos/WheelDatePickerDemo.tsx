import type { DateString } from '@lunisolar-picker/calendar';
import { WheelDatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function WheelDatePickerDemo() {
  const [value, setValue] = useState<DateString | null>('1990-03-15' as DateString);
  return (
    <DemoProvider>
      <WheelDatePicker
        aria-label="Birth date"
        presentation="inline"
        value={value}
        onValueChange={(next) => setValue(next)}
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
