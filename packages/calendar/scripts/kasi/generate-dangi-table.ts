import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeDangiYear } from '../../src/dangi/table-codec';
import { buildYearRecords, DANGI_FIRST_YEAR, lastEpochDayOf } from './build-year-records';
import type { KasiDataFile } from './kasi-types';
import { renderDangiTableModule } from './render-dangi-table';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataPath = path.join(packageRoot, 'data/kasi-dangi-months.json');
const outputPath = path.join(packageRoot, 'src/dangi/dangi-table.generated.ts');

const generateDangiTable = async (): Promise<void> => {
  const dataFile = JSON.parse(await readFile(dataPath, 'utf8')) as KasiDataFile; // as: 수집 스크립트가 쓴 JSON의 형식을 신뢰함
  const records = buildYearRecords(dataFile.monthStarts, DANGI_FIRST_YEAR);
  const lastEpochDay = lastEpochDayOf(dataFile.monthStarts);
  const source = renderDangiTableModule({
    firstYear: DANGI_FIRST_YEAR,
    lastEpochDay,
    encodedYears: records.map(encodeDangiYear),
  });
  await writeFile(outputPath, source);
  const lastRecord = records.at(-1);
  console.info(
    `wrote ${records.length} lunar years (${DANGI_FIRST_YEAR}-${lastRecord?.year}); final year has ${lastRecord?.monthLengths.length} known months; last epoch day ${lastEpochDay}`,
  );
};

try {
  await generateDangiTable();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
