import { epochDayFromCivil } from '@lunisolar-picker/calendar';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { renderWithHydration } from '../testing/expect-hydration';
import { useToday } from './use-today';

type TodayProbeProps = { readonly timeZone?: string; readonly today?: string };

const TodayProbe = ({ timeZone, today }: TodayProbeProps): ReactElement => <output>{useToday(timeZone, today)}</output>;

const renderToThrow = (element: ReactElement): void => {
  renderToString(element);
};

afterEach(() => {
  vi.useRealTimers();
});

describe('useToday', () => {
  it('uses the fixed today string when given', async () => {
    const screen = await render(<TodayProbe today="2026-10-14" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 14)));
  });

  it('throws for a fixed today that is not a canonical date', () => {
    expect(() => renderToThrow(<TodayProbe today="2026-1-5" />)).toThrow(/today must be/);
  });

  it('moves to the next day after midnight in the given time zone', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-14T14:59:30Z'));
    const screen = await render(<TodayProbe timeZone="Asia/Seoul" />);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 14)));

    await vi.advanceTimersByTimeAsync(60_000);

    await expect.element(screen.getByRole('status')).toHaveTextContent(String(epochDayFromCivil(2026, 10, 15)));
  });

  it('hydrates without a mismatch when neither a time zone nor today is given', async () => {
    const { recoverableErrors, unmount } = await renderWithHydration(<TodayProbe />);

    expect(recoverableErrors).toEqual([]);
    unmount();
  });
});
