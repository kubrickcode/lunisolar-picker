import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', dangi: 'src/dangi/index.ts' },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
});
