import { type CalendarSystem, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { type ReactElement, StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { parseOptionalDate } from './parse-controlled-value';
import { useParsedValue } from './use-parsed-value';

const CALENDAR_ID_SEPARATOR = ',';
const LUNAR_VALUE = '1990-06-23[u-ca=dangi]';

type CalendarProbeProps = {
  readonly initialCalendars: readonly CalendarSystem[];
  readonly onInvalidValue: (input: string, reason: string) => void;
};

type ProbeProps = { readonly onInvalidValue: (input: string, reason: string) => void };

const Probe = ({ onInvalidValue }: ProbeProps): ReactElement => {
  const [value, setValue] = useState('2026-1-5');
  const [renderCount, setRenderCount] = useState(0);
  const controlled = useParsedValue(
    value,
    (input) => parseOptionalDate(input, [gregory]),
    String,
    onInvalidValue,
    gregory.id,
  );
  return (
    <>
      <output>{String(controlled.value)}</output>
      <button type="button" onClick={() => setRenderCount(renderCount + 1)}>
        Re-render
      </button>
      <button type="button" onClick={() => setValue('2026-10-14')}>
        Fix value
      </button>
      <button type="button" onClick={() => setValue('2026-1-5')}>
        Break value
      </button>
    </>
  );
};

const CalendarProbe = ({ initialCalendars, onInvalidValue }: CalendarProbeProps): ReactElement => {
  const [calendars, setCalendars] = useState(initialCalendars);
  const controlled = useParsedValue(
    LUNAR_VALUE,
    (input) => parseOptionalDate(input, calendars),
    String,
    onInvalidValue,
    calendars.map((calendar) => calendar.id).join(CALENDAR_ID_SEPARATOR),
  );
  return (
    <>
      <output>{String(controlled.value)}</output>
      <button type="button" onClick={() => setCalendars([gregory, dangi])}>
        Add dangi
      </button>
      <button type="button" onClick={() => setCalendars([gregory])}>
        Remove dangi
      </button>
    </>
  );
};

describe('useParsedValue', () => {
  it('treats an invalid controlled value as empty and reports it once per input', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<Probe onInvalidValue={onInvalidValue} />);

    await screen.getByRole('button', { name: 'Re-render' }).click();
    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('null');
    expect(onInvalidValue).toHaveBeenCalledOnce();
    expect(onInvalidValue).toHaveBeenCalledWith('2026-1-5', 'invalid-date');
  });

  it('accepts the value once it becomes canonical', async () => {
    const screen = await render(<Probe onInvalidValue={vi.fn()} />);

    await screen.getByRole('button', { name: 'Fix value' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('2026-10-14');
  });

  it('reports again when the same invalid input comes back after a valid one', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(<Probe onInvalidValue={onInvalidValue} />);

    await screen.getByRole('button', { name: 'Fix value' }).click();
    await screen.getByRole('button', { name: 'Break value' }).click();

    await expect.poll(() => onInvalidValue.mock.calls.length).toBe(2);
  });

  it('reports only once under StrictMode double effects', async () => {
    const onInvalidValue = vi.fn();
    const screen = await render(
      <StrictMode>
        <Probe onInvalidValue={onInvalidValue} />
      </StrictMode>,
    );

    await screen.getByRole('button', { name: 'Re-render' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('null');
    expect(onInvalidValue).toHaveBeenCalledOnce();
  });

  describe('parseKey', () => {
    it('accepts a value rejected under the previous configuration', async () => {
      const onInvalidValue = vi.fn();
      const screen = await render(<CalendarProbe initialCalendars={[gregory]} onInvalidValue={onInvalidValue} />);
      await expect.element(screen.getByRole('status')).toHaveTextContent('null');

      await screen.getByRole('button', { name: 'Add dangi' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent(LUNAR_VALUE);
      expect(onInvalidValue).toHaveBeenCalledOnce();
    });

    it('rejects and reports a value that the new configuration cannot read', async () => {
      const onInvalidValue = vi.fn();
      const screen = await render(
        <CalendarProbe initialCalendars={[gregory, dangi]} onInvalidValue={onInvalidValue} />,
      );
      await expect.element(screen.getByRole('status')).toHaveTextContent(LUNAR_VALUE);

      await screen.getByRole('button', { name: 'Remove dangi' }).click();

      await expect.element(screen.getByRole('status')).toHaveTextContent('null');
      await expect.poll(() => onInvalidValue.mock.calls).toEqual([[LUNAR_VALUE, 'invalid-date']]);
    });
  });
});
