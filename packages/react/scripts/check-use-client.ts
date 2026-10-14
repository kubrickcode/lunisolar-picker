import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Constraint: RSC 서버 파일이 계약 배열을 실제 값으로 읽어야 하므로 contract 진입점에는 지시문을 붙이지 않음
const SERVER_SAFE_FILE = 'contract.js';
const USE_CLIENT_PATTERN = /^(['"])use client\1;?/;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(packageRoot, 'dist');

const checkUseClientDirectives = async (): Promise<void> => {
  const javascriptFiles = (await readdir(distDirectory)).filter((fileName) => fileName.endsWith('.js'));
  if (javascriptFiles.length === 0) throw new Error('dist has no .js files; run the build first');
  const sources = await Promise.all(
    javascriptFiles.map(async (fileName) => ({
      fileName,
      hasDirective: USE_CLIENT_PATTERN.test(await readFile(path.join(distDirectory, fileName), 'utf8')),
    })),
  );
  const missingFiles = sources
    .filter(({ fileName, hasDirective }) => fileName !== SERVER_SAFE_FILE && !hasDirective)
    .map(({ fileName }) => fileName);
  if (missingFiles.length > 0) throw new Error(`"use client" is missing at the top of: ${missingFiles.join(', ')}`);
  const isServerSafeFileMarked = sources.some(
    ({ fileName, hasDirective }) => fileName === SERVER_SAFE_FILE && hasDirective,
  );
  if (isServerSafeFileMarked) throw new Error(`${SERVER_SAFE_FILE} must not carry "use client"`);
  console.info(
    `"use client" is the first statement in all ${javascriptFiles.length - 1} files except ${SERVER_SAFE_FILE}`,
  );
};

try {
  await checkUseClientDirectives();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
