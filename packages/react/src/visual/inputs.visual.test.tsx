import '@lunisolar-picker/theme/mono.css';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import * as DateField from '../date-field/parts';
import * as TimeField from '../time-field/parts';
import * as Wheel from '../wheel/parts';

const months = Array.from({ length: 12 }, (_, index) => ({
  isDisabled: false,
  label: `${index + 1}월`,
  value: index + 1,
}));

const THEMES = ['light', 'dark'] as const;

type FrameProps = {
  readonly children: ReactNode;
  readonly theme: (typeof THEMES)[number];
};

const Frame = ({ theme, children }: FrameProps): ReactElement => (
  <div
    data-testid="frame"
    data-theme={theme}
    style={{
      alignItems: 'flex-start',
      background: 'var(--lsp-bg)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
      gap: 12,
      padding: 24,
    }}
  >
    {children}
  </div>
);

describe.each(THEMES)('inputs in %s mode', (theme) => {
  it('date field: filled, placeholder, and invalid', async () => {
    const screen = await render(
      <Frame theme={theme}>
        <DateField.Root aria-label="filled" locale={ko} today="2026-10-14" defaultValue="2026-10-14" />
        <DateField.Root aria-label="placeholder" locale={ko} today="2026-10-14" />
        <DateField.Root
          aria-label="lunar"
          locale={ko}
          today="2026-10-14"
          calendars={[dangi]}
          defaultValue="1990-06-23[u-ca=dangi]"
        />
        <DateField.Root aria-label="invalid" locale={ko} today="2026-10-14" invalid defaultValue="2026-10-14" />
      </Frame>,
    );

    await expect.element(screen.getByTestId('frame')).toMatchScreenshot(`date-field-${theme}`);
  });

  it('time field and wheel', async () => {
    const screen = await render(
      <Frame theme={theme}>
        <TimeField.Root aria-label="time" defaultValue="14:30" />
        <Wheel.Root aria-label="month">
          <Wheel.Highlight />
          <Wheel.Column label="month" options={months} value={10} onValueChange={() => {}} />
        </Wheel.Root>
      </Frame>,
    );

    await expect.element(screen.getByTestId('frame')).toMatchScreenshot(`time-and-wheel-${theme}`);
  });
});
