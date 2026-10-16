import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Constraint: 글꼴 렌더링이 OS마다 달라 기준 이미지는 Linux Docker(scripts/run-visual-tests.sh)에서만 만들고 비교함 (스펙 11장)
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  test: {
    include: ['src/**/*.visual.test.tsx'],
    setupFiles: ['./vitest.setup.ts', './vitest.visual.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 480, height: 640 },
    },
  },
});
