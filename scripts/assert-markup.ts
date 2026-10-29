import { readFile } from 'node:fs/promises';

const [, , htmlFilePath, ...expectedFragments] = process.argv;

async function assertMarkup(): Promise<void> {
  if (!htmlFilePath || expectedFragments.length === 0) {
    throw new Error('usage: tsx scripts/assert-markup.ts <html-file> <fragment>...');
  }
  const html = await readFile(htmlFilePath, 'utf8');
  const missingFragments = expectedFragments.filter((fragment) => !html.includes(fragment));
  if (missingFragments.length > 0) {
    throw new Error(`${htmlFilePath} is missing: ${missingFragments.join(' | ')}`);
  }
  console.info(`${htmlFilePath}: all ${expectedFragments.length} fragments present`);
}

try {
  await assertMarkup();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
