import { type ReactElement, StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useValueBridge } from './use-value-bridge';

type BridgeProbeProps = {
  readonly controlledValue?: string | null;
  readonly onSync?: ((value: string | null) => void) | undefined;
  readonly onValueChange: (value: string | null) => void;
};

type ParentProps = {
  readonly onSync?: ((value: string | null) => void) | undefined;
  readonly onValueChange: (value: string | null) => void;
};

const BridgeProbe = ({ controlledValue, onSync, onValueChange }: BridgeProbeProps): ReactElement => {
  const [storeValue, setStoreValue] = useState<string | null>(controlledValue ?? null);
  useValueBridge<string>({
    committedValue: storeValue,
    controlled: { isControlled: controlledValue !== undefined, value: controlledValue ?? null },
    isEqual: Object.is,
    syncStore: (value) => {
      onSync?.(value);
      setStoreValue(value);
    },
    onValueChange,
  });
  return (
    <>
      <output>{String(storeValue)}</output>
      <button type="button" onClick={() => setStoreValue('2026-10-14')}>
        Pick
      </button>
    </>
  );
};

const ControlledParent = ({ onSync, onValueChange }: ParentProps): ReactElement => {
  const [value, setValue] = useState<string | null>('2026-01-01');
  return (
    <>
      <BridgeProbe controlledValue={value} onSync={onSync} onValueChange={onValueChange} />
      <button type="button" onClick={() => setValue('2026-02-02')}>
        Set from parent
      </button>
    </>
  );
};

const AcceptingParent = ({ onSync }: Pick<ParentProps, 'onSync'>): ReactElement => {
  const [value, setValue] = useState<string | null>('2026-01-01');
  return <BridgeProbe controlledValue={value} onSync={onSync} onValueChange={setValue} />;
};

describe('useValueBridge', () => {
  it('reports a user change exactly once', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<BridgeProbe onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
  });

  it('syncs a parent value into the store without reporting it back', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<ControlledParent onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Set from parent' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-02-02');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not sync the store back when the parent accepts the reported value', async () => {
    const onSync = vi.fn();
    const screen = await render(<AcceptingParent onSync={onSync} />);

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14');
    expect(onSync).not.toHaveBeenCalled();
  });

  it('keeps the user value when the parent ignores the change', async () => {
    const onSync = vi.fn();
    const onValueChange = vi.fn();
    const screen = await render(<ControlledParent onSync={onSync} onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14');
    expect(onSync).not.toHaveBeenCalled();
  });

  it('reports nothing on mount and a user change once under StrictMode', async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <StrictMode>
        <BridgeProbe controlledValue="2026-01-01" onValueChange={onValueChange} />
      </StrictMode>,
    );

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
  });
});
