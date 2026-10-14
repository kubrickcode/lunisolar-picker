import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderWithHydration } from '../testing/expect-hydration';
import { formElementOf } from '../testing/form-element';
import { settleEffects } from '../testing/settle-effects';
import * as TimeField from './parts';

const dispatchPaste = (element: Element, text: string): void => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  element.dispatchEvent(event);
};

const catchError = (action: () => void): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
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

type EndOfDayHarnessProps = {
  readonly initialValue?: string | null | undefined;
  readonly isControlled: boolean;
  readonly isEndOfDayAllowedAtMount: boolean;
  readonly onInvalidValue: (input: string) => void;
  readonly onValueChange: (value: string | null) => void;
};

const EndOfDayHarness = ({
  initialValue,
  isControlled,
  isEndOfDayAllowedAtMount,
  onInvalidValue,
  onValueChange,
}: EndOfDayHarnessProps) => {
  const [isEndOfDayAllowed, setIsEndOfDayAllowed] = useState(isEndOfDayAllowedAtMount);
  const [value, setValue] = useState<string | null | undefined>(initialValue);
  return (
    <>
      <TimeField.Root
        aria-label="Time"
        isEndOfDayAllowed={isEndOfDayAllowed}
        onInvalidValue={onInvalidValue}
        onValueChange={onValueChange}
        {...(isControlled ? { value } : { defaultValue: initialValue })}
      />
      <button type="button" onClick={() => setIsEndOfDayAllowed((previous) => !previous)}>
        Toggle end of day
      </button>
      <button type="button" onClick={() => setValue(null)}>
        Parent clears
      </button>
    </>
  );
};

const EchoingParent = ({
  onInvalidValue,
  onValueChange,
}: Pick<EndOfDayHarnessProps, 'onInvalidValue' | 'onValueChange'>) => {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <TimeField.Root
        aria-label="Time"
        value={value}
        onInvalidValue={onInvalidValue}
        onValueChange={(next) => {
          onValueChange(next);
          setValue(next);
        }}
      />
      <button type="button" onClick={() => setValue('24:00')}>
        Parent sets 24:00
      </button>
    </>
  );
};

const clearBothSegments = async (screen: Awaited<ReturnType<typeof render>>): Promise<void> => {
  for (const name of ['Hour', 'Minute']) {
    await clickToFocus(screen.getByRole('spinbutton', { name }));
    await userEvent.keyboard('{Backspace}');
  }
};

describe('TimeField', () => {
  it('reads 930 as 09:30', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<TimeField.Root aria-label="시각" locale={ko} onValueChange={onValueChange} />);

    await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.hour }));

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

      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.minute }));

      await userEvent.keyboard('{ArrowUp}');

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:35');
    });

    it('wraps the minute below zero to the last multiple of the step', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <TimeField.Root aria-label="Time" defaultValue="09:00" minuteStep={15} onValueChange={onValueChange} />,
      );

      await clickToFocus(screen.getByRole('spinbutton', { name: 'Minute' }));

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

      await clickToFocus(screen.getByRole('spinbutton', { name: 'Hour' }));

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

    await clickToFocus(screen.getByRole('spinbutton', { name: 'Minute' }));
    await userEvent.keyboard('32');

    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe('09:32');
    await expect.element(screen.getByRole('group')).not.toHaveAttribute('data-invalid');
  });

  describe.each([
    { isControlled: true, label: 'controlled' },
    { isControlled: false, label: 'uncontrolled' },
  ])('24:00 while end of day is disallowed ($label)', ({ isControlled }) => {
    const renderHarness = async (isEndOfDayAllowedAtMount: boolean, initialValue: string | null = '24:00') => {
      const onValueChange = vi.fn();
      const onInvalidValue = vi.fn();
      const screen = await render(
        <EndOfDayHarness
          initialValue={initialValue}
          isControlled={isControlled}
          isEndOfDayAllowedAtMount={isEndOfDayAllowedAtMount}
          onInvalidValue={onInvalidValue}
          onValueChange={onValueChange}
        />,
      );
      return { onInvalidValue, onValueChange, screen };
    };

    it('shows 24 as invalid without any callback after the flip', async () => {
      const { onInvalidValue, onValueChange, screen } = await renderHarness(true);

      await screen.getByRole('button', { name: 'Toggle end of day' }).click();

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
      expect(onInvalidValue.mock.calls).toEqual([]);
    });

    it('shows a 24:00 given at mount as invalid without any callback', async () => {
      const { onInvalidValue, onValueChange, screen } = await renderHarness(false);

      await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
      await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);
      expect(onInvalidValue.mock.calls).toEqual([]);
    });

    it('reports null when the user clears both segments after the flip, and stays empty when flipped back', async () => {
      const { onValueChange, screen } = await renderHarness(true);
      await screen.getByRole('button', { name: 'Toggle end of day' }).click();

      await clearBothSegments(screen);

      await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
      await screen.getByRole('button', { name: 'Toggle end of day' }).click();
      await settleEffects();
      await expect.element(screen.getByRole('group')).not.toHaveAttribute('data-invalid');
      expect(screen.getByRole('group').element().textContent).toBe('HH:mm');
    });
  });

  it('shows a 24:00 the parent sets after mount while disallowed, and again after the user clears it', async () => {
    const onValueChange = vi.fn();
    const onInvalidValue = vi.fn();
    const screen = await render(<EchoingParent onInvalidValue={onInvalidValue} onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Parent sets 24:00' }).click();

    await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
    await settleEffects();
    expect(onValueChange.mock.calls).toEqual([]);
    expect(onInvalidValue.mock.calls).toEqual([]);

    await clickToFocus(screen.getByRole('spinbutton', { name: 'Hour' }));
    await userEvent.keyboard('{Backspace}');
    await expect.poll(() => onValueChange.mock.calls.map(([value]) => value)).toEqual([null]);

    await screen.getByRole('button', { name: 'Parent sets 24:00' }).click();

    await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveAttribute('aria-valuetext', '24');
    await expect.element(screen.getByRole('group')).toHaveAttribute('data-invalid');
  });

  it('empties the field when the parent sets null after the flip', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <EndOfDayHarness
        initialValue="24:00"
        isControlled
        isEndOfDayAllowedAtMount
        onInvalidValue={vi.fn()}
        onValueChange={onValueChange}
      />,
    );
    await screen.getByRole('button', { name: 'Toggle end of day' }).click();

    await screen.getByRole('button', { name: 'Parent clears' }).click();

    await expect.poll(() => screen.getByRole('group').element().textContent).toBe('HH:mm');
    await settleEffects();
    expect(onValueChange.mock.calls).toEqual([]);
  });

  it('still reports a malformed controlled value and shows an empty field', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<TimeField.Root aria-label="Time" value="25:61" onInvalidValue={onInvalidValue} />);

    await expect.poll(() => onInvalidValue.mock.calls.map(([input]) => input)).toEqual(['25:61']);
    expect(screen.getByRole('group').element().textContent).toBe('HH:mm');
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

      await clickToFocus(screen.getByRole('spinbutton', { name: 'Hour' }));

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

  it('focuses the hour segment through the root ref', async () => {
    const ref = createRef<{ focus(): void }>();
    const screen = await render(<TimeField.Root ref={ref} aria-label="Time" />);

    ref.current?.focus();

    await expect.element(screen.getByRole('spinbutton', { name: 'Hour' })).toHaveFocus();
  });

  it('restores the default time when the form resets', async () => {
    const screen = await render(
      <form aria-label="Schedule">
        <TimeField.Root aria-label="Start time" name="startTime" defaultValue="09:00" />
      </form>,
    );
    const form = formElementOf(screen.getByRole('form'));
    await clickToFocus(screen.getByRole('spinbutton', { name: 'Hour' }));
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(() => new FormData(form).get('startTime')).toBe('10:00');

    form.reset();

    await expect.poll(() => new FormData(form).get('startTime')).toBe('09:00');
    await expect.element(screen.getByRole('group')).toHaveTextContent('09:00');
  });

  it('rejects a segment index outside the fields with a typed error', () => {
    const thrown = catchError(() =>
      renderToString(
        <TimeField.Root aria-label="Time">
          <TimeField.Segment index={2} />
        </TimeField.Root>,
      ),
    );

    expect(thrown).toBeInstanceOf(LunisolarPickerError);
  });

  it('hydrates without a mismatch', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(
      <TimeField.Root aria-label="Time" name="startTime" defaultValue="09:00" />,
    );

    expect(recoverableErrors).toEqual([]);
    unmount();
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
