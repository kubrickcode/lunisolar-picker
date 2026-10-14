import { defineConfig } from 'tsdown';

const sharedOptions = {
  clean: false,
  dts: true,
  fixedExtension: false,
  format: 'esm',
  platform: 'neutral',
  sourcemap: true,
  target: 'es2022',
} as const;

// Constraint: 번들러가 소스 모듈의 지시문을 지우므로 산출 청크마다 붙임. RSC 앱에서 부품이 클라이언트 경계가 되어야 함 (스펙 12장)
// Constraint: contract는 서버 파일이 계약 상수를 값으로 읽어야 하므로 지시문 없이 청크를 공유하지 않는 별도 빌드로 냄. 정리는 build 스크립트가 함
export default defineConfig([
  { ...sharedOptions, entry: { index: 'src/index.ts' }, banner: { js: "'use client';" } },
  { ...sharedOptions, entry: { contract: 'src/contract.ts' } },
]);
