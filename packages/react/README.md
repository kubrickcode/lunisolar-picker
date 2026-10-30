# @lunisolar-picker/react

[![npm](https://img.shields.io/npm/v/@lunisolar-picker/react)](https://www.npmjs.com/package/@lunisolar-picker/react)

React 19 hooks, unstyled parts and finished pickers for lunisolar-picker.

```sh
pnpm add @lunisolar-picker/react @lunisolar-picker/core @lunisolar-picker/calendar @lunisolar-picker/theme
```

```tsx
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker, WheelTimePicker } from '@lunisolar-picker/react/pickers';
```

- Finished pickers (`/pickers`): `DatePicker`, `DateRangePicker`, `MonthPicker`, `WheelDatePicker`, `WheelTimePicker`, `TimePicker`.
- Parts: `Calendar`, `RangeCalendar`, `MonthCalendar`, `TimeList`, `DateField`, `DateRangeField`, `TimeField`, `Wheel`, `Popover`, `Sheet`.
- Hooks: `useCalendar`, `useRangeCalendar`, `useMonthCalendar`, `useDateField`, `useDateRangeField`, `useTimeField`, `useWheel`, `useWheelDate`.

Every entry is marked `"use client"`. Parts render `data-lsp-part` and state attributes instead of class names; load `@lunisolar-picker/theme` or style them yourself.

## Links

- [Documentation](https://kubrickcode.github.io/lunisolar-picker/)
- [Repository](https://github.com/kubrickcode/lunisolar-picker) · [Issues](https://github.com/kubrickcode/lunisolar-picker/issues)
- [Changelog](https://github.com/kubrickcode/lunisolar-picker/blob/main/packages/react/CHANGELOG.md)

## License

MIT
