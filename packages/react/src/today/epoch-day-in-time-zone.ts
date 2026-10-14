import { type EpochDay, epochDayFromCivil, LunisolarPickerError } from '@lunisolar-picker/calendar';

const LOCAL_TIME_ZONE_KEY = 'local';
// Constraint: 시간대별 Intl.DateTimeFormat 생성 비용만 줄이는 순수 메모. 요청 데이터가 없어 인스턴스 상태가 아님
const formatterCache = new Map<string, Intl.DateTimeFormat>();

// Constraint: 스토어는 Date 없이 오늘을 받는다. 바인딩에서만 Intl로 해당 시간대의 벽시계 날짜 부분(년·월·일)을 읽고, 로케일은 'en-US'로 고정해 결과가 환경에 따라 달라지지 않게 함
export const epochDayInTimeZone = (instantMilliseconds: number, timeZone: string | undefined): EpochDay => {
  const parts = formatterFor(timeZone).formatToParts(instantMilliseconds);
  const readPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return epochDayFromCivil(readPart('year'), readPart('month'), readPart('day'));
};

const formatterFor = (timeZone: string | undefined): Intl.DateTimeFormat => {
  const key = timeZone ?? LOCAL_TIME_ZONE_KEY;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const baseOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric', year: 'numeric' };
  const formatter = new Intl.DateTimeFormat(
    'en-US',
    timeZone === undefined ? baseOptions : { ...baseOptions, timeZone },
  );
  formatterCache.set(key, formatter);
  return formatter;
};
