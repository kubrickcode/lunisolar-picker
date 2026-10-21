import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

// Constraint: 스펙 11장 예산("실측 후 조정")을 v1 실측값(2026-10-21)에 약 5% 여유를 두어 정함. 회귀를 막는 선이므로 넘으면 예산을 올리지 말고 원인을 보고. 소비자가 minify하는 조건으로 잼
const SIZE_BUDGETS: readonly SizeBudget[] = [
  { label: '@lunisolar-picker/calendar', entry: 'packages/calendar/dist/index.js', maxGzipBytes: 2368 },
  { label: '@lunisolar-picker/calendar/dangi', entry: 'packages/calendar/dist/dangi.js', maxGzipBytes: 3072 },
  { label: 'dangi table only', entry: 'packages/calendar/src/dangi/dangi-table.generated.ts', maxGzipBytes: 1024 },
  { label: '@lunisolar-picker/core', entry: 'packages/core/dist/index.js', maxGzipBytes: 11520 },
  { label: '@lunisolar-picker/core/locales/ko', entry: 'packages/core/dist/locales/ko.js', maxGzipBytes: 2112 },
  { label: '@lunisolar-picker/core/locales/en', entry: 'packages/core/dist/locales/en.js', maxGzipBytes: 2112 },
  { label: '@lunisolar-picker/core/locales/ja', entry: 'packages/core/dist/locales/ja.js', maxGzipBytes: 2112 },
  {
    label: '@lunisolar-picker/react/pickers DatePicker',
    entry: 'packages/react/test/size/date-picker-entry.ts',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    maxGzipBytes: 32768,
  },
];

type BudgetResult = {
  readonly isOverBudget: boolean;
  readonly label: string;
};

type SizeBudget = {
  readonly entry: string;
  readonly external?: readonly string[];
  readonly label: string;
  readonly maxGzipBytes: number;
};

const checkBundleSizes = async (): Promise<void> => {
  // Intentionally sequential - 예산별 측정 결과가 순서대로 출력되어야 읽기 쉬움
  const results = await SIZE_BUDGETS.reduce<Promise<readonly BudgetResult[]>>(
    async (previous, budget) => [...(await previous), await measureBudget(budget)],
    Promise.resolve([]),
  );
  const overBudgetLabels = results.filter((result) => result.isOverBudget).map((result) => result.label);
  if (overBudgetLabels.length > 0) throw new Error(`over size budget: ${overBudgetLabels.join(', ')}`);
};

const measureBudget = async (budget: SizeBudget): Promise<BudgetResult> => {
  const gzipBytes = await measureGzipBytes(budget);
  console.info(`${budget.label}: ${gzipBytes} B gzip (budget ${budget.maxGzipBytes} B)`);
  return { isOverBudget: gzipBytes > budget.maxGzipBytes, label: budget.label };
};

const measureGzipBytes = async (budget: SizeBudget): Promise<number> => {
  const result = await build({
    entryPoints: [budget.entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external: [...(budget.external ?? [])],
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error(`esbuild produced no output for ${budget.entry}`);
  return gzipSync(output.contents).byteLength;
};

try {
  await checkBundleSizes();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
