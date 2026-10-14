import { ko } from '@lunisolar-picker/core/locales/ko';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { settleEffects } from '../testing/settle-effects';
import * as TimeField from './parts';

const dispatchPaste = (element: Element, text: string): void => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  element.dispatchEvent(event);
};

const ControlledTimeField = ({ onValueChange }: { readonly onValueChange: (value: string | null) => void }) => {
  const [value, setValue] = useState<string | null>('09:00');
  return (
    <>
      <TimeField.Root
        aria-label="Time"
        value={value}
        onValueChange={(next) => {
          onValueChange(next);
          setValue(next);
        }}
      />
      <button type="button" onClick={() => setValue('18:45')}>
        Reset
      </button>
    </>
  );
};

describe('TimeField', () => {
  it('reads 930 as 09:30', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<TimeField.Root aria-label="시각" locale={ko} onValueChange={onValueChange} />);

    await screen.getByRole('spinbutton', { name: ko.labels.hour }).click();

    await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveFocus();
    await userEvent.keyboard('930');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:30');
  });

  describe('minute step', () => {
    it('steps the minute up to the next multiple of the step', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root
          aria-label="시각"
          locale={ko}
          defaultValue="09:32"
          minuteStep={5}
          onValueChange={onValueChange}
        />,
      );

      await screen.getByRole('spinbutton', { name: ko.labels.minute }).click();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.minute })).toHaveFocus();
      await userEvent.keyboard('{ArrowUp}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:35');
    });

    it('wraps the minute below zero to the last multiple of the step', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root aria-label="Time" defaultValue="09:00" minuteStep={15} onValueChange={onValueChange} />,
      );

      await screen.getByRole('spinbutton', { name: 'Minute' }).click();

      await expect.element(screen.getByRole('spinbutton', { name: 'Minute' })).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:45');
    });
  });

  it('shows 24-hour digits even in an English locale', async () => {
    const screen = await render(<TimeField.Root aria-label="Time" defaultValue="21:05" />);

    expect(screen.getByRole('group').element().textContent).toBe('21:05');
  });

  describe('end of day', () => {
    it('flags pasted 24:00 as invalid and clamps aria-valuenow when end of day is not allowed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<TimeField.Root aria-label="Time" onValueChange={onValueChange} />);

      dispatchPaste(screen.getByRole('spinbutton', { name: 'Hour' }).element(), '24:00');

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuenow', '23');
      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
      await settleEffects();
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([]);
    });

    it('accepts 24:00 when end of day is allowed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<TimeField.Root aria-label="Time" isEndOfDayAllowed onValueChange={onValueChange} />);

      await screen.getByRole('spinbutton', { name: 'Hour' }).click();

      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveFocus();
      await userEvent.keyboard('2400');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('24:00');
    });

    it('keeps the committed value when the allowance changes after mount', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root aria-label="Time" defaultValue="09:30" isEndOfDayAllowed onValueChange={onValueChange} />,
      );
      await screen.rerender(<TimeField.Root aria-label="Time" defaultValue="09:30" onValueChange={onValueChange} />);
      await settleEffects();

      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuemax', '23');
      await expect.element(screen.getByRole('group')).toHaveTextContent('09:30');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('keeps 24:00 entered but invalid without a callback when the allowance is turned off, then reports the next edit', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root aria-label="Time" defaultValue="24:00" isEndOfDayAllowed onValueChange={onValueChange} />,
      );
      await screen.rerender(<TimeField.Root aria-label="Time" defaultValue="24:00" onValueChange={onValueChange} />);
      await settleEffects();

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
      expect(onValueChange.mock.calls).toEqual([]);

      dispatchPaste(screen.getByRole('spinbutton', { name: 'Hour' }).element(), '23:00');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('23:00');
    });

    it('rejects pasted 24:30 even when end of day is allowed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<TimeField.Root aria-label="Time" isEndOfDayAllowed onValueChange={onValueChange} />);

      dispatchPaste(screen.getByRole('spinbutton', { name: 'Hour' }).element(), '24:30');

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
      await settleEffects();
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([]);
    });
  });

  it('accepts a typed minute that is off the minute step', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <TimeField.Root aria-label="Time" defaultValue="09:00" minuteStep={5} onValueChange={onValueChange} />,
    );

    await screen.getByRole('spinbutton', { name: 'Minute' }).click();
    await expect.element(screen.getByRole('spinbutton', { name: 'Minute' })).toHaveFocus();
    await userEvent.keyboard('32');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:32');
    await expect.element(screen.getByRole('group')).not.toHaveAttribute('data-invalid');
  });

  describe('callbacks', () => {
    it('stays silent on mount and on a locale change', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root aria-label="Time" defaultValue="09:30" onValueChange={onValueChange} />,
      );
      await screen.rerender(
        <TimeField.Root aria-label="Time" defaultValue="09:30" locale={ko} onValueChange={onValueChange} />,
      );
      await settleEffects();

      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toBeInTheDocument();
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('reports a user change once and not the parent echo', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ControlledTimeField onValueChange={onValueChange} />);

      await screen.getByRole('spinbutton', { name: 'Hour' }).click();

      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveFocus();
      await userEvent.keyboard('{ArrowUp}');
      await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
      await settleEffects();

      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(['10:00']);
    });

    it('shows a parent-supplied value without reporting it', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<ControlledTimeField onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.element(screen.getByRole('group')).toHaveTextContent('18:45');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
    });
  });

  it('submits the time under its name and has no accessibility violations', async () => {
    const screen = await render(
      <form aria-label="Schedule">
        <TimeField.Root aria-label="Start time" name="startTime" defaultValue="09:00" />
      </form>,
    );

    // as: 역할 form으로 고른 요소는 form임
    expect(new FormData(screen.getByRole('form').element() as HTMLFormElement).get('startTime')).toBe('09:00');
    await expectNoAxeViolations(screen.container);
  });
});
