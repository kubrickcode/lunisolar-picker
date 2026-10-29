import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { daysInGregorianMonth } from '../../src/epoch-day';
import { extractMonthStarts } from './extract-month-starts';
import { toIsoDate } from './iso-date';
import type { KasiDataFile, KasiDayItem } from './kasi-types';
import { KasiApiError, parseKasiDayItems } from './parse-kasi-xml';

const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getLunCalInfo';
const LAST_GUARANTEED_YEAR = 2050;
const MAX_ATTEMPTS = 3;
const REQUEST_INTERVAL_MILLISECONDS = 120;
const RETRY_BASE_DELAY_MILLISECONDS = 1000;
const ROWS_PER_PAGE = 31;
const SERVICE_KEY_ENVIRONMENT_VARIABLE = 'DATA_GO_KR_SERVICE_KEY';
const SOURCE = '한국천문연구원 음양력 정보 OpenAPI (data.go.kr 15012679) getLunCalInfo';

type SolarMonth = {
  readonly year: number;
  readonly month: number;
};

type MonthRequest = {
  readonly serviceKey: string;
  readonly solarMonth: SolarMonth;
};

const FIRST_SOLAR_MONTH: SolarMonth = { year: 1900, month: 1 };
// Goal: 음력 2050년 마지막 달은 양력 2051년에 걸침. KASI가 제공하는 데까지 받으려고 2051년 초까지 시도하고, 범위를 벗어나는 첫 달에서 멈춤
const LAST_SOLAR_MONTH_TO_TRY: SolarMonth = { year: 2051, month: 3 };

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const environmentFilePath = path.resolve(packageRoot, '../../.env');
const cacheDirectory = path.join(packageRoot, '.cache/kasi');
const outputPath = path.join(packageRoot, 'data/kasi-dangi-months.json');

const labelOf = (solarMonth: SolarMonth): string => `${solarMonth.year}-${String(solarMonth.month).padStart(2, '0')}`;

const isReadable = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readServiceKey = async (): Promise<string> => {
  if (await isReadable(environmentFilePath)) process.loadEnvFile(environmentFilePath);
  const serviceKey = process.env[SERVICE_KEY_ENVIRONMENT_VARIABLE];
  if (!serviceKey) {
    throw new Error(
      `${SERVICE_KEY_ENVIRONMENT_VARIABLE} is not set. 레포 루트 .env에 data.go.kr '한국천문연구원_음양력 정보' 일반 인증키를 넣어 주세요.`,
    );
  }
  // Constraint: 포털이 인코딩된 키(%XX 포함)를 주는 경우가 있음. URLSearchParams가 다시 인코딩하므로 이중 인코딩을 피하려고 한 번 디코딩함
  return serviceKey.includes('%') ? decodeURIComponent(serviceKey) : serviceKey;
};

const listSolarMonths = (first: SolarMonth, last: SolarMonth): readonly SolarMonth[] =>
  Array.from({ length: last.year - first.year + 1 }, (_, yearOffset) => first.year + yearOffset).flatMap((year) => {
    const firstMonth = year === first.year ? first.month : 1;
    const lastMonth = year === last.year ? last.month : 12;
    return Array.from({ length: lastMonth - firstMonth + 1 }, (_, monthOffset) => ({
      year,
      month: firstMonth + monthOffset,
    }));
  });

// Constraint: URL에는 인증키가 들어가므로 로그·오류 메시지에 URL을 남기지 않음
const fetchMonthXml = async ({ serviceKey, solarMonth }: MonthRequest): Promise<string> => {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    serviceKey,
    solYear: String(solarMonth.year),
    solMonth: String(solarMonth.month).padStart(2, '0'),
    numOfRows: String(ROWS_PER_PAGE),
    pageNo: '1',
  }).toString();
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`KASI request for ${labelOf(solarMonth)} failed after ${MAX_ATTEMPTS} attempts`, {
          cause: error,
        });
      }
      console.warn(`retrying ${labelOf(solarMonth)} (attempt ${attempt} failed: ${String(error)})`);
      await delay(RETRY_BASE_DELAY_MILLISECONDS * 2 ** (attempt - 1));
    }
  }
};

const readMonthXml = async (request: MonthRequest): Promise<string> => {
  const cachePath = path.join(cacheDirectory, `${labelOf(request.solarMonth)}.xml`);
  if (await isReadable(cachePath)) return readFile(cachePath, 'utf8');
  const xml = await fetchMonthXml(request);
  parseKasiDayItems(xml);
  await writeFile(cachePath, xml);
  await delay(REQUEST_INTERVAL_MILLISECONDS);
  return xml;
};

// Constraint: solDay를 생략하면 한 달 전체가 온다는 가정에 기대므로, 일부만 오면 표를 만들지 않고 멈춤
const assertWholeMonth = (items: readonly KasiDayItem[], solarMonth: SolarMonth): void => {
  const expectedDays = daysInGregorianMonth(solarMonth.year, solarMonth.month);
  if (items.length !== expectedDays) {
    throw new Error(
      `KASI returned ${items.length} days for ${labelOf(solarMonth)}; expected ${expectedDays}. solDay를 생략했을 때 한 달 전체를 돌려주지 않는 것으로 보임`,
    );
  }
};

// Goal: 2050년까지는 실패를 그대로 던지고, 그 뒤는 KASI 제공 범위 끝으로 보고 수집을 멈춤(null)
const collectMonthItems = async (request: MonthRequest): Promise<readonly KasiDayItem[] | null> => {
  const { solarMonth } = request;
  const isBeyondGuaranteedRange = solarMonth.year > LAST_GUARANTEED_YEAR;
  try {
    const items = parseKasiDayItems(await readMonthXml(request));
    if (isBeyondGuaranteedRange && items.length === 0) return null;
    assertWholeMonth(items, solarMonth);
    return items;
  } catch (error) {
    if (isBeyondGuaranteedRange && error instanceof KasiApiError) {
      console.info(`KASI coverage ends before ${labelOf(solarMonth)} (${error.message})`);
      return null;
    }
    throw error;
  }
};

const writeDataFile = async (items: readonly KasiDayItem[], lastCollectedMonth: SolarMonth): Promise<void> => {
  const monthStarts = extractMonthStarts(items);
  const lastDay = daysInGregorianMonth(lastCollectedMonth.year, lastCollectedMonth.month);
  const dataFile: KasiDataFile = {
    source: SOURCE,
    collectedAt: new Date().toISOString().slice(0, 10),
    solarRange: {
      from: toIsoDate({ ...FIRST_SOLAR_MONTH, day: 1 }),
      to: toIsoDate({ ...lastCollectedMonth, day: lastDay }),
    },
    monthStarts,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataFile, null, 2)}\n`);
  console.info(
    `wrote ${monthStarts.length} lunar month starts (${dataFile.solarRange.from} ~ ${dataFile.solarRange.to})`,
  );
};

const collectKasiData = async (): Promise<void> => {
  const serviceKey = await readServiceKey();
  await mkdir(cacheDirectory, { recursive: true });
  let itemsByMonth: readonly (readonly KasiDayItem[])[] = [];
  let lastCollectedMonth: SolarMonth | undefined;
  for (const solarMonth of listSolarMonths(FIRST_SOLAR_MONTH, LAST_SOLAR_MONTH_TO_TRY)) {
    const monthItems = await collectMonthItems({ serviceKey, solarMonth });
    if (monthItems === null) break;
    itemsByMonth = [...itemsByMonth, monthItems];
    lastCollectedMonth = solarMonth;
  }
  if (!lastCollectedMonth) throw new Error('KASI returned no data at all');
  await writeDataFile(itemsByMonth.flat(), lastCollectedMonth);
};

try {
  await collectKasiData();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
