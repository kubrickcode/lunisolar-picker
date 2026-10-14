import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

// Constraint: 스펙 11장 예산. 소비자가 minify하는 조건으로 잼. 넘으면 예산을 올리지 말고 원인을 보고
const SIZE_BUDGETS: readonly SizeBudget[] = [
  { label: '@lunisolar-picker/calendar', entry: 'packages/calendar/dist/index.js', maxGzipBytes: 2048 },
  { label: '@lunisolar-picker/calendar/dangi', entry: 'packages/calendar/dist/dangi.js', maxGzipBytes: 3072 },
  { label: 'dangi table only', entry: 'packages/calendar/src/dangi/dangi-table.generated.ts', maxGzipBytes: 1024 },
];

type BudgetResult = {
  readonly isOverBudget: boolean;
  readonly label: string;
};

type SizeBudget = {
  readonly entry: string;
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
  const gzipBytes = await measureGzipBytes(budget.entry);
  console.info(`${budget.label}: ${gzipBytes} B gzip (budget ${budget.maxGzipBytes} B)`);
  return { isOverBudget: gzipBytes > budget.maxGzipBytes, label: budget.label };
};

const measureGzipBytes = async (entry: string): Promise<number> => {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error(`esbuild produced no output for ${entry}`);
  return gzipSync(output.contents).byteLength;
};

try {
  await checkBundleSizes();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
