import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USE_CLIENT_PATTERN = /^(['"])use client\1;?/;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(packageRoot, 'dist');

const checkUseClientDirectives = async (): Promise<void> => {
  const javascriptFiles = (await readdir(distDirectory)).filter((fileName) => fileName.endsWith('.js'));
  if (javascriptFiles.length === 0) throw new Error('dist has no .js files; run the build first');
  const sources = await Promise.all(
    javascriptFiles.map(async (fileName) => ({
      fileName,
      source: await readFile(path.join(distDirectory, fileName), 'utf8'),
    })),
  );
  const missingFiles = sources.filter(({ source }) => !USE_CLIENT_PATTERN.test(source)).map(({ fileName }) => fileName);
  if (missingFiles.length > 0) throw new Error(`"use client" is missing at the top of: ${missingFiles.join(', ')}`);
  console.info(`"use client" is the first statement in all ${javascriptFiles.length} files`);
};

try {
  await checkUseClientDirectives();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
