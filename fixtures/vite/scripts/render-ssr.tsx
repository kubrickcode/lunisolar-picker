import { mkdir, writeFile } from 'node:fs/promises';
import { renderToString } from 'react-dom/server';
import { BirthDateForm } from '../src/BirthDateForm';

// Goal: Vite 앱은 브라우저 전용이지만 같은 컴포넌트가 서버 렌더에서도 깨지지 않는지 확인함 (모듈 최상위 window 접근 금지 검증)
async function renderBirthDateForm(): Promise<void> {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/ssr.html', renderToString(<BirthDateForm />));
}

try {
  await renderBirthDateForm();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
