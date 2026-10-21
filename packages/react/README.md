# @lunisolar-picker/react

React 19 hooks, unstyled parts and finished pickers for lunisolar-picker.

```tsx
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker } from '@lunisolar-picker/react/pickers';
```

- Finished pickers (`/pickers`): `DatePicker`, `DateRangePicker`, `MonthPicker`, `WheelDatePicker`, `TimePicker`.
- Parts: `Calendar`, `RangeCalendar`, `MonthCalendar`, `TimeList`, `DateField`, `DateRangeField`, `TimeField`, `Wheel`, `Popover`, `Sheet`.
- Hooks: `useCalendar`, `useRangeCalendar`, `useMonthCalendar`, `useDateField`, `useDateRangeField`, `useTimeField`, `useWheel`, `useWheelDate`.

Every entry is marked `"use client"`. Parts render `data-lsp-part` and state attributes instead of class names; load `@lunisolar-picker/theme` or style them yourself.
