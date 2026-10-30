import type { TimeString } from '@lunisolar-picker/calendar';
import { WheelTimePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

export function WheelTimePickerDemo() {
  const [value, setValue] = useState<TimeString | null>('09:30' as TimeString);
  return (
    <DemoProvider>
      <WheelTimePicker
        aria-label="Birth time"
        presentation="inline"
        minuteStep={5}
        value={value}
        onValueChange={(next) => setValue(next)}
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
