import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { type Browser, chromium } from 'playwright';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
// Constraint: 운영 빌드의 React는 메시지 대신 오류 번호만 남김. 418·419·423·425가 hydration 불일치 번호임
const HYDRATION_ERROR_PATTERN =
  /hydrat|did not match|server rendered|text content does not match|Minified React error #(418|419|423|425)\b/i;
const SETTLE_MILLISECONDS = 500;

const [, , staticDirectoryArgument, pagePath = '/'] = process.argv;

function resolveFilePath(rootDirectory: string, requestUrl: string): string {
  const urlPath = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
  const filePath = path.join(rootDirectory, relativePath);
  const relativeToRoot = path.relative(rootDirectory, filePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`refusing path outside ${rootDirectory}: ${urlPath}`);
  }
  return path.extname(filePath) === '' ? `${filePath}.html` : filePath;
}

function startStaticServer(rootDirectory: string): Promise<Server> {
  const server = createServer(async (request, response) => {
    try {
      const filePath = resolveFilePath(rootDirectory, request.url ?? '/');
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(404);
      response.end(String(error));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Goal: 정적 빌드 결과를 실제 브라우저로 열어 서버 HTML과 첫 클라이언트 렌더가 어긋나지 않는지 확인함 (스펙 11장 소비 환경)
async function checkHydration(): Promise<void> {
  if (!staticDirectoryArgument) throw new Error('usage: tsx scripts/check-hydration.ts <static-dir> [page-path]');
  const rootDirectory = path.resolve(staticDirectoryArgument);
  const server = await startStaticServer(rootDirectory);
  try {
    const browser = await chromium.launch();
    try {
      const { port } = server.address() as AddressInfo;
      await inspectPage(browser, `http://127.0.0.1:${port}${pagePath}`);
      console.info(`${rootDirectory}${pagePath}: hydrated without errors`);
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
}

async function inspectPage(browser: Browser, url: string): Promise<void> {
  const page = await browser.newPage();
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && HYDRATION_ERROR_PATTERN.test(message.text())) problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(SETTLE_MILLISECONDS);
  if ((await page.locator('[data-lsp-part]').count()) === 0) problems.push('no [data-lsp-part] element rendered');
  if (problems.length > 0) throw new Error(`hydration problems on ${pagePath}:\n${problems.join('\n')}`);
}

try {
  await checkHydration();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
