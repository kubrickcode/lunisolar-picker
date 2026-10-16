import { formatTime, parseTime, type TimeString } from '@lunisolar-picker/calendar';
import { buildTimeColumns } from '@lunisolar-picker/core';

const END_OF_DAY = parseTime('24:00', { isEndOfDayAllowed: true });

// Goal: 하루의 시각을 minuteStep 간격으로 나열함. 시·분 후보와 minuteStep 검증(60을 나누지 않으면 LunisolarPickerError)은 시간 휠과 같은 core 정의를 씀
// Constraint: 24:00은 허용될 때 맨 끝에 하나만 둠. 24:30처럼 24시의 다른 분은 시간이 아님 (계약 §2.8 ③)
export const listTimes = (minuteStep: number, isEndOfDayAllowed: boolean): readonly TimeString[] => {
  const { hours, minutes } = buildTimeColumns({ minuteStep, isEndOfDayAllowed: false });
  const dayTimes = hours.flatMap((hour) =>
    minutes.flatMap((minute) => {
      const time = formatTime(hour.value, minute.value);
      return time.isOk ? [time.value] : [];
    }),
  );
  return isEndOfDayAllowed && END_OF_DAY.isOk ? [...dayTimes, END_OF_DAY.value.value] : dayTimes;
};
