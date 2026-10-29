import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Goal: 앞 패키지를 빌드하지 않아도 calendar 소스를 바로 쓰게 `@lunisolar-picker/source` 조건을 맨 앞에 둠. node 환경 테스트는 ssr 조건 목록을 씀
export default defineConfig({
  resolve: { conditions: ['@lunisolar-picker/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@lunisolar-picker/source', ...defaultServerConditions] } },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
