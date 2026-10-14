import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', contract: 'src/contract.ts' },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  // Constraint: 번들러가 소스 모듈의 지시문을 지우므로 산출 청크마다 붙임. RSC 앱에서 부품이 클라이언트 경계가 되어야 함 (스펙 12장)
  banner: { js: "'use client';" },
});
