import type { TimeString } from '@lunisolar-picker/calendar';
import { TimePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function TimePickerDemo() {
  const [value, setValue] = useState<TimeString | null>(null);
  return (
    <DemoProvider>
      <TimePicker
        aria-label="Closing time"
        value={value}
        onValueChange={(next) => setValue(next)}
        minuteStep={5}
        isEndOfDayAllowed
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
