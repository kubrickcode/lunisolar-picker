import { epochDayFromCivil, gregory } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { en } from '@lunisolar-picker/core/locales/en';
import { ja } from '@lunisolar-picker/core/locales/ja';
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

describe('usePickerSettings precedence', () => {
  it('lets component props beat provider values for locale, time zone and calendars', async () => {
    const settings = await readSettings(
      <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14">
        <SettingsProbe calendars={[dangi]} locale={ja} timeZone="UTC" />
      </LunisolarProvider>,
    );

    expect(settings).toMatchObject({ calendars: ['gregory', 'dangi'], locale: 'ja', timeZone: 'UTC' });
  });

  it('merges nested providers so the inner one overrides only what it sets', async () => {
    const settings = await readSettings(
      <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14" weekStartsOn={1}>
        <LunisolarProvider locale={en}>
          <SettingsProbe />
        </LunisolarProvider>
      </LunisolarProvider>,
    );

    expect(settings).toMatchObject({ locale: 'en', timeZone: 'Asia/Seoul', weekStartsOn: 1 });
  });

  it('keeps the calendars identity when an inline array has the same calendars', async () => {
    const seen: (readonly unknown[])[] = [];
    const Probe = (props: SharedPickerProps): ReactElement => {
      seen.push(usePickerSettings(props).calendars);
      return <output>{seen.length}</output>;
    };
    const screen = await render(<Probe calendars={[dangi]} today="2026-10-14" />);

    await screen.rerender(<Probe calendars={[dangi]} today="2026-10-14" />);

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});

describe('withGregorian', () => {
  it('always puts the Gregorian calendar first and drops duplicates', () => {
    expect(withGregorian([dangi, gregory, dangi]).map((calendar) => calendar.id)).toEqual(['gregory', 'dangi']);
  });
});
