import type { PickerContext } from '@lunisolar-picker/core';
import { type ReactElement, useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { usePickerContext } from './use-picker-context';
import { usePickerSettings } from './use-picker-settings';

type ContextProbeProps = { readonly onContext: (context: PickerContext) => void };

const ContextProbe = ({ onContext }: ContextProbeProps): ReactElement => {
  const [renderCount, setRenderCount] = useState(0);
  const [min, setMin] = useState('2026-01-01');
  const settings = usePickerSettings({});
  const context = usePickerContext(settings, { commitMode: 'immediate', constraints: { min }, numberOfMonths: 1 });
  useEffect(() => onContext(context));
  return (
    <>
      <button type="button" onClick={() => setRenderCount(renderCount + 1)}>
        Re-render
      </button>
      <button type="button" onClick={() => setMin('2026-02-01')}>
        Change min
      </button>
    </>
  );
};

describe('usePickerContext', () => {
  it('returns the same context for the same inputs even with an inline constraints object', async () => {
    const onContext = vi.fn();
    const screen = await render(<ContextProbe onContext={onContext} />);

    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.poll(() => onContext.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onContext.mock.calls.at(-1)?.[0]).toBe(onContext.mock.calls[0]?.[0]);
  });

  it('returns a new context when a constraint changes', async () => {
    const onContext = vi.fn();
    const screen = await render(<ContextProbe onContext={onContext} />);

    await screen.getByRole('button', { name: 'Change min' }).click();

    await expect.poll(() => onContext.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onContext.mock.calls.at(-1)?.[0]).not.toBe(onContext.mock.calls[0]?.[0]);
  });
});
