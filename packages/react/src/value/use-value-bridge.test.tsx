import { type ReactElement, StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { settleEffects } from '../testing/settle-effects';
import { useValueBridge } from './use-value-bridge';

const DRAFT_SUFFIX = '?';

type BridgeProbeProps = {
  readonly controlledValue?: string | null | undefined;
  readonly onPick?: (() => void) | undefined;
  readonly onSync?: ((value: string | null) => void) | undefined;
  readonly onValueChange: (value: string | null) => void;
  readonly toPublic?: ((value: string | null) => string | null) | undefined;
};

type ParentProps = {
  readonly onSync?: ((value: string | null) => void) | undefined;
  readonly onValueChange: (value: string | null) => void;
};

const BridgeProbe = ({ controlledValue, onPick, onSync, onValueChange, toPublic }: BridgeProbeProps): ReactElement => {
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
    toPublic,
  });
  return (
    <>
      <output>{String(storeValue)}</output>
      <button type="button" onClick={() => setStoreValue(`2026-10-14${DRAFT_SUFFIX}`)}>
        Draft
      </button>
      <button
        type="button"
        onClick={() => {
          setStoreValue('2026-10-14');
          onPick?.();
        }}
      >
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

const CollidingParent = ({ onValueChange }: Pick<ParentProps, 'onValueChange'>): ReactElement => {
  const [value, setValue] = useState<string | null>('2026-01-01');
  return <BridgeProbe controlledValue={value} onPick={() => setValue('2026-02-02')} onValueChange={onValueChange} />;
};

// Goal: 범위 필드처럼 store에만 있는 초안(접미사 ?)은 공개 값 null로 보이는 부모. 받은 값을 그대로 되돌려 줌
const ProjectingParent = ({ onSync }: Pick<ParentProps, 'onSync'>): ReactElement => {
  const [value, setValue] = useState<string | null>('2026-01-01');
  return (
    <>
      <BridgeProbe
        controlledValue={value}
        onSync={onSync}
        onValueChange={setValue}
        toPublic={(stored) => (stored?.endsWith(DRAFT_SUFFIX) ? null : stored)}
      />
      <button type="button" onClick={() => setValue(`2026-03-03${DRAFT_SUFFIX}`)}>
        Push draft
      </button>
      <button type="button" onClick={() => setValue(null)}>
        Reset
      </button>
    </>
  );
};

const ModeSwitchingParent = (): ReactElement => {
  const [value, setValue] = useState<string | null | undefined>(undefined);
  return (
    <>
      <BridgeProbe controlledValue={value} onValueChange={vi.fn()} />
      <button type="button" onClick={() => setValue('2026-01-01')}>
        Take control
      </button>
    </>
  );
};

const BaselineProbe = ({ onValueChange }: Pick<ParentProps, 'onValueChange'>): ReactElement => {
  const [state, setState] = useState({ baselineKey: 'a', storeValue: '2026-01-01' as string | null });
  useValueBridge<string>({
    baselineKey: state.baselineKey,
    committedValue: state.storeValue,
    controlled: { isControlled: false, value: null },
    isEqual: Object.is,
    syncStore: () => {},
    onValueChange,
  });
  return (
    <>
      <button type="button" onClick={() => setState({ baselineKey: 'b', storeValue: null })}>
        Rebaseline
      </button>
      <button type="button" onClick={() => setState((previous) => ({ ...previous, storeValue: null }))}>
        Clear
      </button>
      <button type="button" onClick={() => setState((previous) => ({ ...previous, storeValue: '2026-10-14' }))}>
        Pick
      </button>
    </>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('converges on the parent value when a user change and a parent change land in one render', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<CollidingParent onValueChange={onValueChange} />);

    await screen.getByRole('button', { name: 'Pick' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-02-02');
    await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14'], ['2026-02-02']]);
  });

  describe('toPublic', () => {
    it('keeps the store when the parent echoes an emitted public value', async () => {
      const onSync = vi.fn();
      const screen = await render(<ProjectingParent onSync={onSync} />);

      await screen.getByRole('button', { name: 'Draft' }).click();

      await settleEffects();
      await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14?');
      expect(onSync).not.toHaveBeenCalled();
    });

    it('syncs a parent reset whose public form was never emitted', async () => {
      const onSync = vi.fn();
      const screen = await render(<ProjectingParent onSync={onSync} />);
      await screen.getByRole('button', { name: 'Push draft' }).click();
      await expect.element(screen.getByRole('status')).toHaveTextContent('2026-03-03?');

      await screen.getByRole('button', { name: 'Reset' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent('null');
      expect(onSync.mock.calls).toEqual([['2026-03-03?'], [null]]);
    });
  });

  it('warns in development when a component switches from uncontrolled to controlled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const screen = await render(<ModeSwitchingParent />);
    expect(warn).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: 'Take control' }).click();

    await expect.poll(() => warn.mock.calls.length).toBe(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/from uncontrolled to controlled/);
  });

  describe('baselineKey', () => {
    it('adopts the committed value silently when the key changes and reports later user changes', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<BaselineProbe onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Rebaseline' }).click();
      await settleEffects();
      expect(onValueChange.mock.calls).toEqual([]);

      await screen.getByRole('button', { name: 'Pick' }).click();
      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-10-14']]);
    });

    it('still reports a value change that happens without a key change', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<BaselineProbe onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Clear' }).click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([[null]]);
    });
  });
});
