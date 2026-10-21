import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const runFile = promisify(execFile);

interface PackedManifest {
  readonly name: string;
  readonly license?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

const PUBLISHED_PACKAGE_DIRECTORIES = [
  'packages/calendar',
  'packages/core',
  'packages/react',
  'packages/theme',
] as const;
// Constraint: exports의 "@lunisolar-picker/source" 조건이 src를 가리켜 publint가 src 동봉을 요구하므로(M1 계획 정합성 조정) TS 소스와 theme CSS는 허용함
const ALLOWED_FILE_PATTERN =
  /^package\/(dist\/.+|src\/.+\.tsx?|src\/mono\.css|src\/bridge\/[^/]+\.css|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/;
const FORBIDDEN_FILE_PATTERN = /\.test\.tsx?$|^package\/src\/(testing|visual)\//;
const REQUIRED_FILES = ['package/package.json', 'package/README.md'] as const;
const WORKSPACE_PROTOCOL = 'workspace:';

type InspectPackageInput = {
  readonly packageDirectory: string;
  readonly workDirectory: string;
};

const checkPackedPackages = async (): Promise<void> => {
  const workDirectory = await mkdtemp(path.join(tmpdir(), 'lunisolar-pack-'));
  try {
    const problemLists = await Promise.all(
      PUBLISHED_PACKAGE_DIRECTORIES.map((packageDirectory) =>
        inspectPackage({ packageDirectory: path.resolve(packageDirectory), workDirectory }),
      ),
    );
    const problems = problemLists.flat();
    if (problems.length > 0) throw new Error(`packed packages have problems:\n${problems.join('\n')}`);
    console.info(`${PUBLISHED_PACKAGE_DIRECTORIES.length} packed packages look publishable`);
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
};

// Goal: 배포 tarball에 workspace: 참조, 테스트·테스트 도우미·KASI 원본이 섞이지 않았는지 publish 전에 확인함 (Review Focus 5)
const inspectPackage = async ({ packageDirectory, workDirectory }: InspectPackageInput): Promise<string[]> => {
  const { stdout } = await runFile('pnpm', ['pack', '--pack-destination', workDirectory], { cwd: packageDirectory });
  const tarballPath = stdout.trim().split('\n').at(-1) ?? '';
  const extractDirectory = await mkdtemp(path.join(workDirectory, 'extract-'));
  await runFile('tar', ['-xzf', tarballPath, '-C', extractDirectory]);
  const files = await listFilesRecursively(path.join(extractDirectory, 'package'));
  // as: JSON.parse는 unknown 대신 any를 돌려줌. pnpm pack이 만든 package.json이라 이 모양이 보장됨
  const manifest = JSON.parse(
    await readFile(path.join(extractDirectory, 'package/package.json'), 'utf8'),
  ) as PackedManifest;
  const dependencyVersions = { ...manifest.dependencies, ...manifest.peerDependencies };
  return [
    ...files.filter((file) => !isPublishableFile(file)).map((file) => `${manifest.name}: unexpected file ${file}`),
    ...REQUIRED_FILES.filter((file) => !files.includes(file)).map((file) => `${manifest.name}: missing ${file}`),
    ...(manifest.license && !files.includes('package/LICENSE')
      ? [`${manifest.name}: license declared but LICENSE missing`]
      : []),
    ...Object.entries(dependencyVersions)
      .filter(([, version]) => version.startsWith(WORKSPACE_PROTOCOL))
      .map(([dependency, version]) => `${manifest.name}: ${dependency} still uses ${version}`),
  ];
};

const listFilesRecursively = async (directory: string, prefix = 'package'): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listFilesRecursively(path.join(directory, entry.name), `${prefix}/${entry.name}`)
        : Promise.resolve([`${prefix}/${entry.name}`]),
    ),
  );
  return nested.flat();
};

const isPublishableFile = (file: string): boolean =>
  ALLOWED_FILE_PATTERN.test(file) && !FORBIDDEN_FILE_PATTERN.test(file);

try {
  await checkPackedPackages();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
