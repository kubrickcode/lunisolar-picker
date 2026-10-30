# @lunisolar-picker/calendar

[![npm](https://img.shields.io/npm/v/@lunisolar-picker/calendar)](https://www.npmjs.com/package/@lunisolar-picker/calendar)

Plain-date values and calendar systems for lunisolar-picker. No runtime dependencies; works on servers and in browsers.

```sh
pnpm add @lunisolar-picker/calendar
```

```ts
import { epochDayOf, formatDate, isSameDay, parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';

parseDate('2026-10-14');
// { isOk: true, value: { year: 2026, monthCode: 'M10', day: 14, calendar: 'gregory', … } }
parseDate('1990-06-23[u-ca=dangi]', { calendars: [dangi] });
// { isOk: true, value: { year: 1990, monthCode: 'M05L', day: 1, calendar: 'dangi', … } }
formatDate(epochDayOf('2026-10-14'), dangi);
// { isOk: true, value: '2026-10-14[u-ca=dangi]' }
isSameDay('2026-10-14', '2026-10-14[u-ca=dangi]'); // true
```

- `gregory`: proleptic Gregorian, years 1–9999.
- `dangi` (separate entry): Korean lunisolar calendar from KASI data, lunar 1900-01-01 to 2050-11-30 (solar 1900-01-31 to 2051-01-12).
- Values: `DateString`, `TimeString`, `MonthString` and `DateRangeValue`, with strict parse and format functions that return a `Result` instead of throwing.

## Links

- [Documentation](https://kubrickcode.github.io/lunisolar-picker/)
- [Repository](https://github.com/kubrickcode/lunisolar-picker) · [Issues](https://github.com/kubrickcode/lunisolar-picker/issues)
- [Changelog](https://github.com/kubrickcode/lunisolar-picker/blob/main/packages/calendar/CHANGELOG.md)

## License

MIT
