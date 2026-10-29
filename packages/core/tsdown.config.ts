import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'locales/ko': 'src/locales/ko.ts',
    'locales/en': 'src/locales/en.ts',
    'locales/ja': 'src/locales/ja.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
});
