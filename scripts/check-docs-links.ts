import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Constraint: GitHub Pages serves the site under this path; root-absolute links in MDX skip it and 404 there
const BASE_PATH = '/lunisolar-picker/';
const EXTERNAL_REFERENCE = /^(?:[a-z]+:|\/\/)/;
const LOCAL_REFERENCE = /(?:href|src)="([^"#?]+)/g;
const SITE_ORIGIN = 'https://site.invalid';

const [, , distDirectory] = process.argv;

async function checkDocsLinks(): Promise<void> {
  if (!distDirectory) {
    throw new Error('usage: tsx scripts/check-docs-links.ts <dist-directory>');
  }
  const htmlFiles = await listHtmlFiles(distDirectory);
  const brokenLinks = (await Promise.all(htmlFiles.map(findBrokenLinks))).flat();
  if (brokenLinks.length > 0) {
    throw new Error(`broken links under ${BASE_PATH}:\n${brokenLinks.join('\n')}`);
  }
  console.info(`${htmlFiles.length} pages: every local link resolves under ${BASE_PATH}`);
}

async function listHtmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

async function findBrokenLinks(htmlFile: string): Promise<string[]> {
  const pagePath = relative(distDirectory ?? '', htmlFile).replace(/index\.html$/, '');
  const pageUrl = new URL(BASE_PATH + pagePath, SITE_ORIGIN);
  const html = await readFile(htmlFile, 'utf8');
  return [...html.matchAll(LOCAL_REFERENCE)]
    .map((match) => match[1] ?? '')
    .filter((reference) => !EXTERNAL_REFERENCE.test(reference))
    .filter((reference) => !resolvesToFile(new URL(reference, pageUrl).pathname))
    .map((reference) => `${htmlFile} -> ${reference}`);
}

function resolvesToFile(urlPath: string): boolean {
  if (!urlPath.startsWith(BASE_PATH)) return false;
  const sitePath = decodeURIComponent(urlPath.slice(BASE_PATH.length));
  const filePath = sitePath === '' || sitePath.endsWith('/') ? join(sitePath, 'index.html') : sitePath;
  return existsSync(join(distDirectory ?? '', filePath));
}

try {
  await checkDocsLinks();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
