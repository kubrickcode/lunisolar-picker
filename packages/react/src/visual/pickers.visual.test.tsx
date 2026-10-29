import '@lunisolar-picker/theme/mono.css';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Calendar, RangeCalendar } from '../index';
import { DatePicker, DateRangePicker, MonthPicker, TimePicker, WheelDatePicker } from '../pickers/index';
import { KoreanProvider } from '../testing/korean-fixture';

// Constraint: vitest.visual.config.ts의 viewport를 다시 적지 않도록 처음 크기를 읽어 둠
const CONFIGURED_VIEWPORT: Viewport = { height: window.innerHeight, width: window.innerWidth };
// Goal: 두 달을 나란히 두는 web-console 데스크톱 폭. 기본 폭(480)에서는 두 달이 세로로 쌓여 화면 밖으로 나감. Linux 글꼴 폭 차이를 견디도록 여유를 둠
const SIDE_BY_SIDE_VIEWPORT: Viewport = { height: 768, width: 1024 };
const STAGE_ID = 'stage';
const SUBJECTS: readonly Subject[] = [
  { name: 'calendar', hasPopover: false, element: <Calendar.Root defaultValue="2026-10-20" /> },
  {
    name: 'range-calendar',
    hasPopover: false,
    element: <RangeCalendar.Root defaultValue={{ start: '2026-10-13', end: '2026-10-17' }} />,
  },
  {
    name: 'date-picker',
    hasPopover: true,
    element: <DatePicker presentation="popover" defaultOpen defaultValue="2026-10-20" />,
  },
  {
    name: 'date-range-picker',
    hasPopover: true,
    element: (
      <DateRangePicker
        presentation="popover"
        defaultOpen
        numberOfMonths={2}
        defaultValue={{ start: '2026-10-13', end: '2026-11-03' }}
      />
    ),
    viewport: SIDE_BY_SIDE_VIEWPORT,
  },
  {
    name: 'month-picker',
    hasPopover: true,
    element: <MonthPicker presentation="popover" defaultOpen defaultValue="2026-10" />,
  },
  {
    name: 'time-picker',
    hasPopover: true,
    element: <TimePicker presentation="popover" defaultOpen minuteStep={30} defaultValue="09:30" />,
  },
  { name: 'wheel-date-picker', hasPopover: false, element: <WheelDatePicker defaultValue="1990-03-15" /> },
];
const THEMES = ['light', 'dark'] as const;

type Subject = {
  readonly element: ReactElement;
  // Goal: 처음부터 열린 팝오버가 포털로 그려질 때까지 기다린 뒤 찍음
  readonly hasPopover: boolean;
  readonly name: string;
  readonly viewport?: Viewport | undefined;
};

type Viewport = {
  readonly height: number;
  readonly width: number;
};

// Goal: 요소 스크린샷은 그 상자만큼 페이지를 잘라 찍으므로, body로 포털된 팝오버가 무대 밖으로 나가 잘리면 기준 이미지가 팝오버를 놓침. 찍기 전에 막음
const expectSurfacesInsideStage = (): void => {
  const stage = page.getByTestId(STAGE_ID).element().getBoundingClientRect();
  const surfaces = Array.from(document.querySelectorAll('[role="dialog"]'), (surface) =>
    surface.getBoundingClientRect(),
  );
  surfaces.forEach((surface) => {
    expect(surface.left).toBeGreaterThanOrEqual(stage.left);
    expect(surface.top).toBeGreaterThanOrEqual(stage.top);
    expect(surface.right).toBeLessThanOrEqual(stage.right);
    expect(surface.bottom).toBeLessThanOrEqual(stage.bottom);
  });
};

// Constraint: 팝오버는 body로 포털되므로 무대가 아니라 html에 테마를 둠. 무대에만 두면 다크 기준 이미지에 밝은 팝오버가 찍힘 (preflight 2.17, 계약 §4)
afterEach(async () => {
  document.documentElement.removeAttribute('data-theme');
  await page.viewport(CONFIGURED_VIEWPORT.width, CONFIGURED_VIEWPORT.height);
});

describe.each(THEMES)('pickers in %s mode', (theme) => {
  it.each(SUBJECTS)('$name', async ({ element, hasPopover, name, viewport }) => {
    document.documentElement.setAttribute('data-theme', theme);
    if (viewport) await page.viewport(viewport.width, viewport.height);
    await render(
      <div data-testid={STAGE_ID} style={{ padding: 16, minHeight: 480, background: 'var(--lsp-bg)' }}>
        <KoreanProvider hasLunar>{element}</KoreanProvider>
      </div>,
    );
    if (hasPopover) await expect.element(page.getByRole('dialog')).toBeVisible();

    expectSurfacesInsideStage();
    await expect.element(page.getByTestId(STAGE_ID)).toMatchScreenshot(`${name}-${theme}`);
  });
});
