import type { KasiDayItem } from './kasi-types';

const DIGITS_ONLY_PATTERN = /^\d+$/;
const ERROR_SNIPPET_LENGTH = 200;
const ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/g;
const SUCCESS_RESULT_CODE = '00';

export class KasiApiError extends Error {
  override readonly name: string = 'KasiApiError';
  readonly code: string;

  constructor(code: string, message: string) {
    super(`KASI API error ${code}: ${message}`);
    this.code = code;
  }
}

export const parseKasiDayItems = (xml: string): KasiDayItem[] => {
  assertSuccessfulResponse(xml);
  const dayItems = Array.from(xml.matchAll(ITEM_PATTERN), ([, itemXml = '']) => parseDayItem(itemXml));
  assertTotalCount(xml, dayItems.length);
  return dayItems;
};

// Constraint: 키 오류·호출 한도 초과 응답에는 item이 없어 빈 달처럼 보임. 조용히 넘기면 표에 구멍이 생기므로 반드시 던짐
const assertSuccessfulResponse = (xml: string): void => {
  const resultCode = findTag(xml, 'resultCode');
  if (resultCode === SUCCESS_RESULT_CODE) return;
  if (resultCode !== undefined) throw new KasiApiError(resultCode, findTag(xml, 'resultMsg') ?? 'no resultMsg');
  const gatewayCode = findTag(xml, 'returnReasonCode') ?? 'gateway';
  const gatewayReason = findTag(xml, 'returnAuthMsg') ?? findTag(xml, 'errMsg');
  throw new KasiApiError(gatewayCode, gatewayReason ?? `unrecognized response: ${xml.slice(0, ERROR_SNIPPET_LENGTH)}`);
};

// Constraint: 페이지 일부만 받으면 달 시작일 표가 중간에서 끊기므로 응답이 선언한 totalCount와 item 수가 같아야 함
const assertTotalCount = (xml: string, itemCount: number): void => {
  const declaredText = findTag(xml, 'totalCount');
  if (declaredText === undefined) return;
  const declaredCount = Number(declaredText);
  if (declaredCount !== itemCount) {
    throw new Error(`KASI totalCount ${declaredCount} does not match ${itemCount} parsed items`);
  }
};

const parseDayItem = (itemXml: string): KasiDayItem => ({
  solarDate: {
    year: readInteger(itemXml, 'solYear'),
    month: readInteger(itemXml, 'solMonth'),
    day: readInteger(itemXml, 'solDay'),
  },
  lunarYear: readInteger(itemXml, 'lunYear'),
  lunarMonth: readInteger(itemXml, 'lunMonth'),
  lunarDay: readInteger(itemXml, 'lunDay'),
  isLeapMonth: readLeapFlag(itemXml),
  lunarMonthDays: readInteger(itemXml, 'lunNday'),
});

const findTag = (xml: string, tag: string): string | undefined =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1]?.trim();

const readTag = (itemXml: string, tag: string): string => {
  const value = findTag(itemXml, tag);
  if (value === undefined || value === '') {
    throw new Error(`KASI item is missing <${tag}>: ${itemXml.slice(0, ERROR_SNIPPET_LENGTH)}`);
  }
  return value;
};

// Constraint: Number()는 "0x10", "1e2"를 정수로 받아들이므로 자릿수 문자열만 허용해 조용한 값 변환을 막음
const readInteger = (itemXml: string, tag: string): number => {
  const text = readTag(itemXml, tag);
  if (!DIGITS_ONLY_PATTERN.test(text)) throw new Error(`KASI item <${tag}> is not an integer: "${text}"`);
  return Number(text);
};

const readLeapFlag = (itemXml: string): boolean => {
  const flag = readTag(itemXml, 'lunLeapmonth');
  if (flag === '윤') return true;
  if (flag === '평') return false;
  throw new Error(`unexpected lunLeapmonth value "${flag}"`);
};
