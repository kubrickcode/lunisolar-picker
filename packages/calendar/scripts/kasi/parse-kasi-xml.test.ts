import { describe, expect, it } from 'vitest';
import { KasiApiError, parseKasiDayItems } from './parse-kasi-xml';

const kasiItem = (fields: { solarDay: string; lunarDay: string; leapFlag: string; lunarMonthDays: string }): string =>
  `<item><lunDay>${fields.lunarDay}</lunDay><lunIljin>갑자(甲子)</lunIljin><lunLeapmonth>${fields.leapFlag}</lunLeapmonth><lunMonth>06</lunMonth><lunNday>${fields.lunarMonthDays}</lunNday><lunSecha>을사(乙巳)</lunSecha><lunWolgeon>계미(癸未)</lunWolgeon><lunYear>2025</lunYear><solDay>${fields.solarDay}</solDay><solJd>2460882</solJd><solLeapyear>평</solLeapyear><solMonth>07</solMonth><solWeek>금</solWeek><solYear>2025</solYear></item>`;

const kasiResponse = (items: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>${items}</items><numOfRows>31</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

describe('parseKasiDayItems', () => {
  it('reads each day item with its leap flag and lunar month length', () => {
    const xml = kasiResponse(
      kasiItem({ solarDay: '25', lunarDay: '01', leapFlag: '윤', lunarMonthDays: '29' }) +
        kasiItem({ solarDay: '26', lunarDay: '02', leapFlag: '윤', lunarMonthDays: '29' }),
    );

    expect(parseKasiDayItems(xml)).toEqual([
      {
        solarDate: { year: 2025, month: 7, day: 25 },
        lunarYear: 2025,
        lunarMonth: 6,
        lunarDay: 1,
        isLeapMonth: true,
        lunarMonthDays: 29,
      },
      {
        solarDate: { year: 2025, month: 7, day: 26 },
        lunarYear: 2025,
        lunarMonth: 6,
        lunarDay: 2,
        isLeapMonth: true,
        lunarMonthDays: 29,
      },
    ]);
  });

  it('raises the service error code instead of returning an empty month', () => {
    const xml =
      '<response><header><resultCode>22</resultCode><resultMsg>LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR.</resultMsg></header></response>';

    expect(() => parseKasiDayItems(xml)).toThrow(KasiApiError);
    expect(() => parseKasiDayItems(xml)).toThrow(/22/);
  });

  it('raises the gateway reason when the service key is rejected', () => {
    const xml =
      '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';

    expect(() => parseKasiDayItems(xml)).toThrow(/SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
  });

  it('refuses an item with an unknown leap flag', () => {
    const xml = kasiResponse(kasiItem({ solarDay: '25', lunarDay: '01', leapFlag: '?', lunarMonthDays: '29' }));

    expect(() => parseKasiDayItems(xml)).toThrow(/lunLeapmonth/);
  });

  it('refuses an item missing a required field', () => {
    const xml = kasiResponse('<item><lunDay>01</lunDay></item>');

    expect(() => parseKasiDayItems(xml)).toThrow(/missing <solYear>/);
  });
});
