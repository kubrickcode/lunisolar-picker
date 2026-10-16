import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { Calendar, type PartName, RangeCalendar } from '../index';
import { renderWithHydration } from '../testing/expect-hydration';
import { KoreanProvider } from '../testing/korean-fixture';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker } from './index';

// Goal: Next(web-console)·Astro(saju-pictures) SSR에서 서버 HTML과 첫 클라이언트 렌더가 같은지 고정함 (스펙 11장). 오늘은 KoreanProvider가 고정함

type HydrationCase = readonly [name: string, part: PartName, element: ReactElement];

const CLOSED_CASES: readonly HydrationCase[] = [
  ['Calendar', 'calendar', <Calendar.Root key="calendar" defaultValue="2026-10-20" />],
  [
    'RangeCalendar with lunar labels',
    'calendar',
    <RangeCalendar.Root key="range-calendar" defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
  ],
  ['DatePicker', 'date-picker', <DatePicker key="date" presentation="popover" defaultValue="2026-10-20" />],
  ['DateRangePicker', 'date-range-picker', <DateRangePicker key="range" presentation="popover" />],
  ['MonthPicker', 'month-picker', <MonthPicker key="month" presentation="popover" defaultValue="2026-10" />],
  ['WheelDatePicker inline', 'wheel-date-picker', <WheelDatePicker key="wheel" defaultValue="1990-03-15" />],
  [
    'WheelDatePicker sheet',
    'wheel-date-picker',
    <WheelDatePicker key="wheel-sheet" presentation="sheet" defaultValue="1990-06-23[u-ca=dangi]" />,
  ],
  ['TimePicker', 'time-picker', <TimePicker key="time" presentation="popover" defaultValue="09:30" />],
];

// Constraint: 팝오버·시트 콘텐츠는 마운트 뒤에만 포털로 그려지므로 처음부터 열린 picker도 서버 HTML에는 닫힌 모습이어야 함 (계약 §3.3 Popover)
const INITIALLY_OPEN_CASES: readonly HydrationCase[] = [
  ['DatePicker', 'date-picker', <DatePicker key="date" presentation="popover" defaultOpen defaultValue="2026-10-20" />],
  [
    'DateRangePicker',
    'date-range-picker',
    <DateRangePicker key="range" presentation="popover" defaultOpen numberOfMonths={2} />,
  ],
  ['MonthPicker', 'month-picker', <MonthPicker key="month" presentation="popover" defaultOpen />],
  [
    'WheelDatePicker sheet',
    'wheel-date-picker',
    <WheelDatePicker key="wheel-sheet" presentation="sheet" defaultOpen defaultValue="1990-03-15" />,
  ],
  ['TimePicker', 'time-picker', <TimePicker key="time" presentation="popover" defaultOpen minuteStep={30} />],
];

const partSelector = (part: PartName): string => `[data-lsp-part="${part}"]`;

// Goal: React 19는 텍스트 불일치를 recoverable error로, 속성 불일치를 개발 모드 console.error로만 알리므로 둘 다 봄
const watchConsoleErrors = () => vi.spyOn(console, 'error');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server rendering', () => {
  it.each(CLOSED_CASES)('hydrates %s without mismatches', async (_, part, element) => {
    const consoleError = watchConsoleErrors();

    const { container, recoverableErrors } = await renderWithHydration(
      <KoreanProvider hasLunar>{element}</KoreanProvider>,
    );

    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector(partSelector(part))).toBeInstanceOf(HTMLElement);
  });

  it.each(INITIALLY_OPEN_CASES)('hydrates an initially open %s and opens it afterwards', async (_, part, element) => {
    const consoleError = watchConsoleErrors();
    const app = <KoreanProvider hasLunar>{element}</KoreanProvider>;
    const serverHtml = renderToString(app);

    const { container, recoverableErrors } = await renderWithHydration(app);

    expect(serverHtml).not.toContain('role="dialog"');
    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector(partSelector(part))).toHaveAttribute('data-open');
    await expect.element(page.getByRole('dialog')).toBeVisible();
  });
});
