import { epochDayFromCivil } from '@lunisolar-picker/calendar';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { renderWithHydration } from '../testing/expect-hydration';
import { epochDayInTimeZone } from './epoch-day-in-time-zone';
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

  it('hydrates a fixed today without a mismatch and shows the fixed day', async () => {
    const { container, recoverableErrors } = await renderWithHydration(<TodayProbe today="2026-10-14" />);

    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe(String(epochDayFromCivil(2026, 10, 14)));
  });

  it('renders the UTC day on the server, hydrates without a mismatch, then settles to the client day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T23:30:00Z'));
    const serverMarkup = renderToString(<TodayProbe />);

    const { container, recoverableErrors } = await renderWithHydration(<TodayProbe />);

    expect(serverMarkup).toContain(String(epochDayFromCivil(2026, 10, 14)));
    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe(String(epochDayInTimeZone(Date.now(), undefined)));
  });

  it('hydrates without a mismatch when neither a time zone nor today is given', async () => {
    const { container, recoverableErrors } = await renderWithHydration(<TodayProbe />);

    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe(String(epochDayInTimeZone(Date.now(), undefined)));
  });

  it('rejects an unknown time zone with the bad value in the message', () => {
    expect(() => renderToThrow(<TodayProbe timeZone="Mars/Olympus" />)).toThrow(/Mars\/Olympus/);
  });
});

describe('renderWithHydration', () => {
  it('reports a recoverable error for a component that renders differently on the client', async () => {
    let renderCount = 0;
    const Mismatch = (): ReactElement => <output>{renderCount++}</output>;

    const { recoverableErrors } = await renderWithHydration(<Mismatch />);

    expect(recoverableErrors.length).toBeGreaterThan(0);
  });
});
