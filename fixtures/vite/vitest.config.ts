import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  // Constraint: 브라우저 모드는 처음 만나는 의존성을 실행 중에 최적화하며 페이지를 다시 로드함. 미리 지정하지 않으면 react가 두 벌 로드돼 "Invalid hook call"로 실패함
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-hook-form',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'vitest-browser-react',
    ],
  },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
