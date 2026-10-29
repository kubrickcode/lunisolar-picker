import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['@lunisolar-picker/source', ...defaultClientConditions],
    dedupe: ['react', 'react-dom'],
  },
  // Constraint: 브라우저 모드는 처음 만나는 의존성을 실행 중에 최적화하며 페이지를 다시 로드함. 미리 지정하지 않으면 첫 실행이 "Invalid hook call"과 iframe 타임아웃으로 실패함
  optimizeDeps: {
    include: [
      '@floating-ui/react-dom',
      'axe-core',
      'fast-check',
      'react',
      'react-dom',
      'react-dom/client',
      'react-dom/server',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'vitest-browser-react',
    ],
  },
  ssr: { resolve: { conditions: ['@lunisolar-picker/source', ...defaultServerConditions] } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.visual.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      // Constraint: 실패 스크린샷이 __screenshots__ 폴더를 만들면 visual 기준 이미지 폴더와 섞이고 커밋 게이트가 미추적 파일로 잡음
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
});
