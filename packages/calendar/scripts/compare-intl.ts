import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dangi } from '../src/dangi/index';
import { brandEpochDay, civilFromEpochDay, type EpochDay } from '../src/epoch-day';
import { toMonthCode } from '../src/month-code';
import { toIsoDate } from './kasi/iso-date';

const LEAP_MARKER = '윤';
const MILLISECONDS_PER_DAY = 86_400_000;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(packageRoot, '.cache/intl-dangi-diff.md');
const intlFormatter = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

type IntlDifference = {
  readonly intl: string;
  readonly kasi: string;
  readonly solarDate: string;
};

// Goal: 정보용 리포트. 브라우저마다 Intl이 KASI와 다른 날짜를 기록해 두고 빌드는 막지 않음 (스펙 5.3)
const compareWithIntl = async (): Promise<void> => {
  const { min, max } = dangi.supportedRange;
  const epochDays = Array.from({ length: max - min + 1 }, (_, offset) => brandEpochDay(min + offset));
  const differences = epochDays.flatMap(findDifference);
  const rows = differences.map((difference) => `| ${difference.solarDate} | ${difference.kasi} | ${difference.intl} |`);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, ['| 양력 | KASI | Intl |', '|---|---|---|', ...rows, ''].join('\n'));
  console.info(`Node ${process.version}: ${differences.length} days differ from Intl dangi. report: ${reportPath}`);
};

const findDifference = (epochDay: EpochDay): IntlDifference[] => {
  const fields = dangi.fromEpochDay(epochDay);
  if (!fields.isOk) throw new Error(`dangi rejected a supported day ${epochDay}: ${fields.error}`);
  const kasi = `${fields.value.year} ${fields.value.monthCode} ${fields.value.day}`;
  const intl = describeIntlDate(epochDay);
  if (kasi === intl) return [];
  return [{ solarDate: toIsoDate(civilFromEpochDay(epochDay)), kasi, intl }];
};

const describeIntlDate = (epochDay: EpochDay): string => {
  const parts = intlFormatter.formatToParts(new Date(epochDay * MILLISECONDS_PER_DAY));
  const partOf = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  const monthText = partOf('month');
  const monthCode = toMonthCode(Number(monthText.replace(/\D/g, '')), monthText.includes(LEAP_MARKER));
  return `${partOf('relatedYear') || partOf('year')} ${monthCode} ${partOf('day')}`;
};

try {
  await compareWithIntl();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
