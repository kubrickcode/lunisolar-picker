import { type EpochDay, LunisolarPickerError, parseDate } from '@lunisolar-picker/calendar';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { epochDayInTimeZone } from './epoch-day-in-time-zone';

const SERVER_FALLBACK_TIME_ZONE = 'UTC';
const TODAY_CHECK_INTERVAL_MILLISECONDS = 60_000;

export const useToday = (timeZone: string | undefined, today: string | undefined): EpochDay => {
  const fixedEpochDay = useMemo(() => parseFixedToday(today), [today]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (fixedEpochDay !== null) return () => {};
      const timer = setInterval(onChange, TODAY_CHECK_INTERVAL_MILLISECONDS);
      return () => clearInterval(timer);
    },
    [fixedEpochDay],
  );
  const readClientToday = (): EpochDay => fixedEpochDay ?? epochDayInTimeZone(Date.now(), timeZone);
  // Constraint: 서버(Cloudflare 등)는 UTC로 돈다. 시간대가 없으면 서버 렌더와 hydration 첫 렌더를 UTC로 맞추고, 그 뒤 브라우저 시간대로 바꿈 (스펙 6.2)
  const readServerToday = (): EpochDay =>
    fixedEpochDay ?? epochDayInTimeZone(Date.now(), timeZone ?? SERVER_FALLBACK_TIME_ZONE);
  return useSyncExternalStore(subscribe, readClientToday, readServerToday);
};

const parseFixedToday = (today: string | undefined): EpochDay | null => {
  if (today === undefined) return null;
  const parsed = parseDate(today);
  if (!parsed.isOk) throw new LunisolarPickerError(`today must be a YYYY-MM-DD date string, received "${today}"`);
  return parsed.value.epochDay;
};
