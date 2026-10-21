import type { DateString } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { WheelDatePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const LUNAR_CALENDARS = [dangi];

// Goal: 2023년 윤2월 15일로 열어, 연도를 윤2월이 없는 해로 굴리면 평달 2월로 옮겨지는 것을 보이게 함
export function LunarWheelDatePickerDemo() {
  const [value, setValue] = useState<DateString | null>('2023-04-05[u-ca=dangi]' as DateString);
  return (
    <DemoProvider locale={ko} calendars={LUNAR_CALENDARS}>
      <WheelDatePicker
        aria-label="음력 날짜"
        presentation="inline"
        value={value}
        onValueChange={(next) => setValue(next)}
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
}
