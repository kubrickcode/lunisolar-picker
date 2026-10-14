import { epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { ko } from '@lunisolar-picker/core/locales/ko';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { LunisolarProvider } from './lunisolar-provider';
import type { SharedPickerProps } from './shared-picker-props';
import { usePickerSettings, withGregorian } from './use-picker-settings';

const SettingsProbe = (props: SharedPickerProps): ReactElement => {
  const settings = usePickerSettings(props);
  return (
    <output>
      {JSON.stringify({
        calendars: settings.calendars.map((calendar) => calendar.id),
        locale: settings.locale.id,
        timeZone: settings.timeZone ?? null,
        today: settings.todayEpochDay,
        weekStartsOn: settings.weekStartsOn,
      })}
    </output>
  );
};

const readSettings = async (element: ReactElement): Promise<Record<string, unknown>> => {
  const screen = await render(element);
  return JSON.parse(screen.getByRole('status').element().textContent ?? '{}') as Record<string, unknown>; // as: 프로브가 직접 만든 JSON이라 형태가 고정됨
};

describe('usePickerSettings', () => {
  it('falls back to English, the locale week start, and the Gregorian calendar', async () => {
    const settings = await readSettings(<SettingsProbe today="2026-10-14" />);

    expect(settings).toEqual({
      calendars: ['gregory'],
      locale: 'en',
      timeZone: null,
      today: epochDayFromCivil(2026, 10, 14),
      weekStartsOn: 0,
    });
  });

  it('takes provider settings and lets component props override them', async () => {
    const settings = await readSettings(
      <LunisolarProvider calendars={[dangi]} locale={ko} timeZone="Asia/Seoul" today="2026-10-14" weekStartsOn={1}>
        <SettingsProbe weekStartsOn={0} />
      </LunisolarProvider>,
    );

    expect(settings).toMatchObject({
      calendars: ['gregory', 'dangi'],
      locale: 'ko',
      timeZone: 'Asia/Seoul',
      weekStartsOn: 0,
    });
  });
});

describe('withGregorian', () => {
  it('always puts the Gregorian calendar first and drops duplicates', () => {
    expect(withGregorian([dangi, gregory, dangi]).map((calendar) => calendar.id)).toEqual(['gregory', 'dangi']);
  });
});
