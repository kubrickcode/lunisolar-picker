# @lunisolar-picker/core

[![npm](https://img.shields.io/npm/v/@lunisolar-picker/core)](https://www.npmjs.com/package/@lunisolar-picker/core)

Framework-agnostic state for lunisolar-picker: pure reducers and small stores for navigation, single and range selection, segmented fields, wheels and time, plus constraints, month grids, gesture math and locales. No DOM access.

```sh
pnpm add @lunisolar-picker/react @lunisolar-picker/core @lunisolar-picker/calendar @lunisolar-picker/theme
```

```ts
import { validateRange } from '@lunisolar-picker/core';

validateRange({ start: '2026-10-01', end: '2026-12-31' }, { maxDays: 60 });
// { isValid: false, reasons: ['range-too-long'], ignoredInputs: [] }
```

Locales: `@lunisolar-picker/core/locales/en`, `/ko` and `/ja`. Add your own with `defineLocale`.

Most apps use this package through `@lunisolar-picker/react`.

## Links

- [Documentation](https://kubrickcode.github.io/lunisolar-picker/)
- [Repository](https://github.com/kubrickcode/lunisolar-picker) · [Issues](https://github.com/kubrickcode/lunisolar-picker/issues)
- [Changelog](https://github.com/kubrickcode/lunisolar-picker/blob/main/packages/core/CHANGELOG.md)

## License

MIT
