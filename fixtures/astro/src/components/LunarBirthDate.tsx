import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker } from '@lunisolar-picker/react/pickers';

// Goal: saju-pictures와 같은 구성(Astro island + 음력 입력)에서 음력 표기 값이 SSR과 hydration 뒤에 같은지 확인함 (Review Focus 4)
export function LunarBirthDate() {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14" calendars={[dangi]}>
      <DatePicker
        name="birthDate"
        defaultValue="1990-06-23[u-ca=dangi]"
        defaultDisplayCalendar="dangi"
        max="2026-10-14"
      />
    </LunisolarProvider>
  );
}
