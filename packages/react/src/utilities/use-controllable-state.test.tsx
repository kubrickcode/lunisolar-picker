import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { useControllableState } from './use-controllable-state';

type Setter = (next: string) => void;

const renderState = async (controlled: string | undefined, onChange: ((value: string) => void) | undefined) => {
  const captured: { value: string; setValue: Setter } = { value: '', setValue: () => {} };
  const Probe = () => {
    const [value, setValue] = useControllableState(controlled, 'A', onChange);
    // 의도적 변경: 렌더 결과를 테스트가 읽도록 바깥 객체에 기록함
    captured.value = value;
    captured.setValue = setValue;
    return <output>{value}</output>;
  };
  const screen = await render(<Probe />);
  return { captured, screen };
};

describe('useControllableState', () => {
  it('reports a change without keeping state when controlled', async () => {
    const onChange = vi.fn();
    const { captured, screen } = await renderState('A', onChange);

    await act(async () => captured.setValue('B'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('B');
    await expect.element(screen.getByText('A')).toBeInTheDocument();
  });

  it('updates its own state and reports once when uncontrolled', async () => {
    const onChange = vi.fn();
    const { captured, screen } = await renderState(undefined, onChange);

    await act(async () => captured.setValue('B'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('B');
    await expect.element(screen.getByText('B')).toBeInTheDocument();
  });

  it('compares against the newest value for calls in one batch', async () => {
    const onChange = vi.fn();
    const { captured, screen } = await renderState(undefined, onChange);

    await act(async () => {
      captured.setValue('B');
      captured.setValue('A');
    });

    expect(onChange.mock.calls).toEqual([['B'], ['A']]);
    await expect.element(screen.getByText('A')).toBeInTheDocument();
  });

  it('reports a repeated value in one batch only once', async () => {
    const onChange = vi.fn();
    const { captured } = await renderState(undefined, onChange);

    await act(async () => {
      captured.setValue('B');
      captured.setValue('B');
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('B');
  });

  it('does not report when the value is unchanged', async () => {
    const onChange = vi.fn();
    const { captured } = await renderState(undefined, onChange);

    await act(async () => captured.setValue('A'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
