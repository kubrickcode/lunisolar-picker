import type { MonthCode } from '@lunisolar-picker/calendar';
import { VALID } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { dayLabel, KoreanProvider } from '../testing/korean-fixture';
import { dispatchPointer } from '../testing/pointer';
import { settleEffects } from '../testing/settle-effects';
import { RangeCalendar } from './index';

// Constraint: 머묾 판정(500ms)과 판정 주기를 넘기되 두 번째 넘김(1000ms)에는 닿지 않는 시간
const EDGE_WAIT_MS = 800;
const EDGE_OVERSHOOT_PIXELS = 20;
const IN_RANGE_SELECTOR = '[data-lsp-part="calendar-cell"][data-in-range]:not([data-outside])';
const ROOT_SELECTOR = '[data-lsp-part="calendar"]';

type EdgeCase = {
  readonly direction: 'ltr' | 'rtl';
  readonly expectedMonth: MonthCode;
  readonly side: 'left' | 'right';
};

type Screen = Awaited<ReturnType<typeof render>>;

const renderInKorean = (element: ReactElement): Promise<Screen> => render(<KoreanProvider>{element}</KoreanProvider>);

const dayButton = (screen: Screen, isoDate: string): HTMLElement => {
  const element = screen.getByRole('button', { name: dayLabel(isoDate) }).element();
  if (!(element instanceof HTMLElement)) throw new Error(`day ${isoDate} should render a button`);
  return element;
};

const inRangeCount = (screen: Screen): number => screen.container.querySelectorAll(IN_RANGE_SELECTOR).length;

const monthName = (monthCode: MonthCode): string => ko.formatHeading({ year: 2026, monthCode }, 'gregory');

const rootRect = (screen: Screen): DOMRect => {
  const root = screen.container.querySelector(ROOT_SELECTOR);
  if (!root) throw new Error('calendar root should render');
  return root.getBoundingClientRect();
};

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('RangeCalendar pointer', () => {
  describe('mouse drag', () => {
    it('selects a range by dragging and reports it once on release', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);

      await userEvent.dragAndDrop(
        screen.getByRole('button', { name: dayLabel('2026-10-06') }),
        screen.getByRole('button', { name: dayLabel('2026-10-09') }),
      );

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-06', end: '2026-10-09' }, { validity: VALID }]);
      await settleEffects();
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('previews the range while dragging over days', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover');

      await expect.poll(() => inRangeCount(screen)).toBe(4);
      expect(onValueChange).not.toHaveBeenCalled();
      dispatchPointer(document, 'pointerup');
    });

    it('resizes a complete range by grabbing its end', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(
        <RangeCalendar.Root defaultValue={{ start: '2026-10-06', end: '2026-10-09' }} onValueChange={onValueChange} />,
      );

      await userEvent.dragAndDrop(
        screen.getByRole('button', { name: dayLabel('2026-10-09') }),
        screen.getByRole('button', { name: dayLabel('2026-10-12') }),
      );

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-06', end: '2026-10-12' }, { validity: VALID }]);
    });

    it('completes the dragged range when the browser cancels the pointer', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover');
      dispatchPointer(document, 'pointercancel');

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-06', end: '2026-10-09' }, { validity: VALID }]);
    });
  });

  // Review Focus 4: 달력 밖에서 손을 뗀 드래그가 남아 다음 호버가 범위를 바꾸면 안 됨
  describe('release outside the calendar', () => {
    it('forgets the drag when released outside the calendar so later hovering changes nothing', async () => {
      const screen = await renderInKorean(<RangeCalendar.Root />);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(document, 'pointerup', { clientX: -50, clientY: -50 });
      await expect.poll(() => inRangeCount(screen)).toBe(1);
      dispatchPointer(dayButton(screen, '2026-10-20'), 'pointerover');
      await settleEffects();

      expect(inRangeCount(screen)).toBe(1);
    });

    it('ends the drag when a mouse move reports no pressed button after a missed release', async () => {
      const screen = await renderInKorean(<RangeCalendar.Root />);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(document, 'pointermove', { buttons: 0, clientX: -50, clientY: -50 });
      await expect.poll(() => inRangeCount(screen)).toBe(1);
      dispatchPointer(dayButton(screen, '2026-10-20'), 'pointerover');
      await settleEffects();

      expect(inRangeCount(screen)).toBe(1);
    });
  });

  describe('edge dwell', () => {
    it.each<EdgeCase>([
      { direction: 'ltr', side: 'right', expectedMonth: 'M11' },
      { direction: 'ltr', side: 'left', expectedMonth: 'M09' },
      { direction: 'rtl', side: 'left', expectedMonth: 'M11' },
    ])(
      'moves one month after dwelling outside the $side edge in $direction',
      async ({ direction, expectedMonth, side }) => {
        const screen = await renderInKorean(<RangeCalendar.Root dir={direction} />);
        const { left, right, top } = rootRect(screen);
        const outsidePoint = {
          clientX: side === 'right' ? right + EDGE_OVERSHOOT_PIXELS : left - EDGE_OVERSHOOT_PIXELS,
          clientY: top + EDGE_OVERSHOOT_PIXELS,
        };

        dispatchPointer(dayButton(screen, '2026-10-14'), 'pointerdown');
        dispatchPointer(document, 'pointermove', outsidePoint);
        await wait(EDGE_WAIT_MS);
        dispatchPointer(document, 'pointerup', outsidePoint);

        await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName(expectedMonth));
      },
    );

    it('stops paging once the drag ends', async () => {
      const screen = await renderInKorean(<RangeCalendar.Root />);
      const { right, top } = rootRect(screen);
      const outsidePoint = { clientX: right + EDGE_OVERSHOOT_PIXELS, clientY: top + EDGE_OVERSHOOT_PIXELS };

      dispatchPointer(dayButton(screen, '2026-10-14'), 'pointerdown');
      dispatchPointer(document, 'pointermove', outsidePoint);
      dispatchPointer(document, 'pointerup', outsidePoint);
      await wait(EDGE_WAIT_MS);

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(monthName('M10'));
    });
  });

  describe('pointer types', () => {
    it('drags with a pen like a mouse', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown', { pointerType: 'pen' });
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover', { pointerType: 'pen' });
      dispatchPointer(document, 'pointerup', { pointerType: 'pen' });

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-06', end: '2026-10-09' }, { validity: VALID }]);
    });

    it('uses two taps instead of dragging on touch screens', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);

      for (const isoDate of ['2026-10-06', '2026-10-08']) {
        const button = dayButton(screen, isoDate);
        dispatchPointer(button, 'pointerdown', { pointerType: 'touch' });
        dispatchPointer(button, 'pointerup', { pointerType: 'touch' });
        button.click();
      }

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-06', end: '2026-10-08' }, { validity: VALID }]);
    });

    it('accepts a click that arrives without a press after an earlier mouse drag', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);
      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover');
      dispatchPointer(document, 'pointerup');
      await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
      // Constraint: 실제 보조 기술의 클릭은 드래그를 끝낸 작업보다 한참 뒤에 옴
      await settleEffects();

      // Goal: 보조 기술은 누르기 없이 클릭(detail 1)만 보낼 수 있음. 지난 마우스 드래그 때문에 그 클릭을 버리면 안 됨
      for (const isoDate of ['2026-10-20', '2026-10-22']) {
        dayButton(screen, isoDate).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        await settleEffects();
      }

      await expect
        .poll(() => onValueChange.mock.lastCall)
        .toEqual([{ start: '2026-10-20', end: '2026-10-22' }, { validity: VALID }]);
    });
  });

  describe('non-interactive states', () => {
    it.each([
      { state: 'disabled', props: { disabled: true }, attribute: 'data-disabled' },
      { state: 'read-only', props: { readOnly: true }, attribute: 'data-readonly' },
    ])('ignores a mouse drag when $state', async ({ attribute, props }) => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root {...props} onValueChange={onValueChange} />);
      await expect.element(screen.getByRole('grid')).toBeVisible();
      expect(screen.container.querySelector(ROOT_SELECTOR)).toHaveAttribute(attribute);

      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover');
      dispatchPointer(document, 'pointerup');
      await settleEffects();

      expect(inRangeCount(screen)).toBe(0);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('drops a drag in progress when the calendar becomes read-only', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInKorean(<RangeCalendar.Root onValueChange={onValueChange} />);
      dispatchPointer(dayButton(screen, '2026-10-06'), 'pointerdown');
      dispatchPointer(dayButton(screen, '2026-10-09'), 'pointerover');
      await expect.poll(() => inRangeCount(screen)).toBe(4);

      await screen.rerender(
        <KoreanProvider>
          <RangeCalendar.Root readOnly onValueChange={onValueChange} />
        </KoreanProvider>,
      );
      await expect.poll(() => inRangeCount(screen)).toBe(0);
      dispatchPointer(dayButton(screen, '2026-10-12'), 'pointerover');
      dispatchPointer(document, 'pointerup');
      await settleEffects();

      expect(inRangeCount(screen)).toBe(0);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
