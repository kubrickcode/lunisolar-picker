import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { COARSE_NARROW_SCREEN_QUERY, resolvePresentation, usePresentation } from './use-presentation';

type ChangeListener = () => void;

const stubMatchMedia = (initialMatches: boolean) => {
  const listeners = new Set<ChangeListener>();
  const state = { matches: initialMatches };
  const query = {
    get matches() {
      return state.matches;
    },
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  };
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(() => query as unknown as MediaQueryList); // as: 테스트에 필요한 멤버만 가진 대역
  const change = (matches: boolean) => {
    state.matches = matches;
    for (const listener of listeners) listener();
  };
  return { change, listeners, spy };
};

const Probe = () => <output>{usePresentation('auto')}</output>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolvePresentation', () => {
  it.each([
    ['auto', true, 'sheet'],
    ['auto', false, 'popover'],
    ['popover', true, 'popover'],
    ['sheet', false, 'sheet'],
  ] as const)('resolves %s on a coarse narrow screen (%s) to %s', (presentation, isCoarseNarrowScreen, expected) => {
    expect(resolvePresentation(presentation, isCoarseNarrowScreen)).toBe(expected);
  });
});

describe('usePresentation', () => {
  it('follows media query changes and unsubscribes on unmount', async () => {
    const media = stubMatchMedia(false);
    const screen = await render(<Probe />);
    await expect.element(screen.getByRole('status')).toHaveTextContent('popover');
    expect(media.spy).toHaveBeenCalledWith(COARSE_NARROW_SCREEN_QUERY);

    await act(async () => media.change(true));
    await expect.element(screen.getByRole('status')).toHaveTextContent('sheet');

    expect(media.listeners.size).toBe(1);
    await screen.unmount();
    expect(media.listeners.size).toBe(0);
  });
});
