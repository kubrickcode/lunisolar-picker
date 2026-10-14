import type { KasiDayItem } from './kasi-types';

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
  return Array.from(xml.matchAll(ITEM_PATTERN), ([, itemXml = '']) => ({
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
  }));
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

const findTag = (xml: string, tag: string): string | undefined =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1]?.trim();

const readTag = (itemXml: string, tag: string): string => {
  const value = findTag(itemXml, tag);
  if (value === undefined || value === '') {
    throw new Error(`KASI item is missing <${tag}>: ${itemXml.slice(0, ERROR_SNIPPET_LENGTH)}`);
  }
  return value;
};

const readInteger = (itemXml: string, tag: string): number => {
  const text = readTag(itemXml, tag);
  const value = Number(text);
  if (!Number.isInteger(value)) throw new Error(`KASI item <${tag}> is not an integer: "${text}"`);
  return value;
};

const readLeapFlag = (itemXml: string): boolean => {
  const flag = readTag(itemXml, 'lunLeapmonth');
  if (flag === '윤') return true;
  if (flag === '평') return false;
  throw new Error(`unexpected lunLeapmonth value "${flag}"`);
};
