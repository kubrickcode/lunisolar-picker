import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@lunisolar-picker/source', ...defaultServerConditions] } },
  test: { include: ['tests/**/*.test.ts'] },
});
