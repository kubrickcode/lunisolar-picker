type DangiTableModuleInput = {
  readonly firstYear: number;
  readonly lastEpochDay: number;
  readonly encodedYears: readonly number[];
};

export const renderDangiTableModule = (input: DangiTableModuleInput): string => {
  const rows = input.encodedYears.map((encoded, index) => `  ${encoded}, // ${input.firstYear + index}\n`).join('');
  return [
    '// 생성 파일: 직접 수정 금지. `pnpm --filter @lunisolar-picker/calendar run kasi:generate`로 다시 만든다.',
    '// 출처: data/kasi-dangi-months.json (한국천문연구원 음양력 정보 OpenAPI). 비트 배치는 src/dangi/table-codec.ts 참고',
    "import type { EpochDay } from '../epoch-day';",
    '',
    `export const DANGI_FIRST_YEAR: number = ${input.firstYear};`,
    `export const DANGI_LAST_EPOCH_DAY: EpochDay = ${input.lastEpochDay} as EpochDay; // as: 생성 단계에서 검증한 정수 epoch day에 브랜드 부여`,
    `export const DANGI_YEAR_TABLE: readonly number[] = [\n${rows}];`,
    '',
  ].join('\n');
};
