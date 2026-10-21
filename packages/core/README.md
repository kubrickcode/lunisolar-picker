# @lunisolar-picker/core

Framework-agnostic state for lunisolar-picker: pure reducers and small stores for navigation, single and range selection, segmented fields, wheels and time, plus constraints, month grids, gesture math and locales. No DOM access.

```ts
import { validateRange } from '@lunisolar-picker/core';

validateRange({ start: '2026-10-01', end: '2026-12-31' }, { maxDays: 60 });
// { isValid: false, reasons: ['range-too-long'], ignoredInputs: [] }
```

Locales: `@lunisolar-picker/core/locales/en`, `/ko` and `/ja`. Add your own with `defineLocale`.

Most apps use this package through `@lunisolar-picker/react`.
