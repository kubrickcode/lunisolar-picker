import { parseTime, type TimeString } from '@lunisolar-picker/calendar';

// Goal: TimeString은 브랜드 타입이라 테스트도 공개 parseTime을 거쳐 만듦 (문자열 리터럴은 타입 검사에서 막힘)
export const timeString = (text: string): TimeString => {
  const parsed = parseTime(text, { isEndOfDayAllowed: true });
  if (!parsed.isOk) throw new Error(`test time "${text}" is not a valid TimeString: ${parsed.error}`);
  return parsed.value.value;
};
