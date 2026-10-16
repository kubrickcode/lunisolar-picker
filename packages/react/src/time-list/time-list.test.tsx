import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import { listTimes, TimeList } from './index';

// Goal: 목록이 화면 아래에 있어야 페이지까지 스크롤하는 구현(scrollIntoView)을 가려낼 수 있음
const BELOW_THE_FOLD_SPACER_STYLE = { blockSize: 2000 } as const;
const LIST_LABEL = '시작 시각';
const SCROLLING_LIST_STYLE = { maxBlockSize: 200, overflowY: 'auto' } as const;
const TAB_STOP_SELECTOR = '[role="option"][tabindex="0"]';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const tabStopText = (container: HTMLElement): string | null =>
  container.querySelector(TAB_STOP_SELECTOR)?.textContent ?? null;

describe('listTimes', () => {
  it('lists every step of the day and adds 24:00 only when allowed', () => {
    expect(listTimes(5, false)).toHaveLength(288);
    expect(listTimes(30, true).at(-1)).toBe('24:00');
    expect(listTimes(30, false).at(-1)).toBe('23:30');
  });

  it('rejects a minute step that does not divide an hour', () => {
    expect(() => listTimes(7, false)).toThrow(LunisolarPickerError);
  });
});

describe('TimeList', () => {
  describe('selection', () => {
    it('selects an option by click and by keyboard', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <KoreanProvider>
          <TimeList.Root aria-label={LIST_LABEL} minuteStep={5} defaultValue="09:30" onValueChange={onValueChange} />
        </KoreanProvider>,
      );

      await clickToFocus(screen.getByRole('option', { name: '09:35' }));
      await userEvent.keyboard('{ArrowDown}{Enter}');

      expect(onValueChange.mock.calls).toEqual([
        ['09:35', VALID_DETAILS],
        ['09:40', VALID_DETAILS],
      ]);
      await expect.element(screen.getByRole('option', { name: '09:40' })).toHaveAttribute('aria-selected', 'true');
    });

    it('stays silent when the selected option is chosen again', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeList.Root aria-label={LIST_LABEL} defaultValue="09:30" onValueChange={onValueChange} />,
      );

      await clickToFocus(screen.getByRole('option', { name: '09:30' }));
      await userEvent.keyboard('{Enter}');
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('returns to the parent value when the parent keeps it unchanged', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeList.Root aria-label={LIST_LABEL} value="09:30" onValueChange={onValueChange} />,
      );

      await screen.getByRole('option', { name: '10:00' }).click();
      await settleEffects();

      expect(onValueChange).toHaveBeenCalledWith('10:00', VALID_DETAILS);
      await expect.element(screen.getByRole('option', { name: '09:30' })).toHaveAttribute('aria-selected', 'true');
      await expect.element(screen.getByRole('option', { name: '10:00' })).toHaveAttribute('aria-selected', 'false');
    });

    it('has no axe violations', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} defaultValue="09:30" />);
      await expect.element(screen.getByRole('listbox', { name: LIST_LABEL })).toBeVisible();

      await expectNoAxeViolations(screen.container);
    });
  });

  describe('end of day', () => {
    it('offers 24:00 only when the end of day is allowed', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} isEndOfDayAllowed />);

      await expect.element(screen.getByRole('option', { name: '24:00' })).toBeInTheDocument();
      expect(screen.getByRole('option').all()).toHaveLength(49);
    });

    it('selects nothing for a disallowed 24:00 and parks the tab stop on the last option', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} value="24:00" />);
      await expect.element(screen.getByRole('listbox')).toBeVisible();

      expect(screen.container.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(tabStopText(screen.container)).toBe('23:30');
    });
  });

  describe('roving tab stop', () => {
    it('marks only the selected option for initial focus', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} defaultValue="13:00" />);
      await expect.element(screen.getByRole('listbox')).toBeVisible();

      const autofocusTexts = Array.from(
        screen.container.querySelectorAll('[data-autofocus]'),
        (element) => element.textContent,
      );
      expect(autofocusTexts).toEqual(['13:00']);
      expect(tabStopText(screen.container)).toBe('13:00');
    });

    it('starts on the step before a value between steps', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} minuteStep={15} value="09:37" />);
      await expect.element(screen.getByRole('listbox')).toBeVisible();

      expect(screen.container.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(tabStopText(screen.container)).toBe('09:30');
    });

    it('follows a new value from the parent', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} value="09:30" />);
      await screen.rerender(<TimeList.Root aria-label={LIST_LABEL} value="15:00" />);

      await expect.element(screen.getByRole('option', { name: '15:00' })).toHaveAttribute('tabindex', '0');
      expect(screen.container.querySelectorAll(TAB_STOP_SELECTOR)).toHaveLength(1);
    });

    it.each([
      ['{Home}', '00:00'],
      ['{End}', '23:30'],
      ['{ArrowUp}', '09:00'],
    ])('moves focus with %s', async (keys, expectedTime) => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} defaultValue="09:30" />);
      await focusDirectly(screen.getByRole('option', { name: '09:30' }));

      await userEvent.keyboard(keys);

      await expect.element(screen.getByRole('option', { name: expectedTime })).toHaveFocus();
      expect(tabStopText(screen.container)).toBe(expectedTime);
    });

    it('stays on the first option at the top', async () => {
      const screen = await render(<TimeList.Root aria-label={LIST_LABEL} defaultValue="00:00" />);
      await focusDirectly(screen.getByRole('option', { name: '00:00' }));

      await userEvent.keyboard('{ArrowUp}');
      await settleEffects();

      await expect.element(screen.getByRole('option', { name: '00:00' })).toHaveFocus();
    });
  });

  describe('scrolling', () => {
    it('scrolls the selected option into the list on mount without scrolling the page', async () => {
      const screen = await render(
        <>
          <div style={BELOW_THE_FOLD_SPACER_STYLE} />
          <TimeList.Root aria-label={LIST_LABEL} defaultValue="18:00" style={SCROLLING_LIST_STYLE} />
        </>,
      );
      const list = screen.getByRole('listbox').element();
      const option = screen.getByRole('option', { name: '18:00' }).element();

      await expect.poll(() => list.scrollTop).toBeGreaterThan(0);
      const listRect = list.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      expect(optionRect.top).toBeGreaterThanOrEqual(listRect.top);
      expect(optionRect.bottom).toBeLessThanOrEqual(listRect.bottom);
      expect(window.scrollY).toBe(0);
    });
  });
});
