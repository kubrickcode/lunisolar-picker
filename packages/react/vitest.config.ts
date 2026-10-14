import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
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
