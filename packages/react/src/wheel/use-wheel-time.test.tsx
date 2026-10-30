import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { VALID } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { Component, type ReactNode, useState } from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { focusDirectly } from '../testing/focus-directly';
import { formElementOf } from '../testing/form-element';
import { KoreanProvider } from '../testing/korean-fixture';
import { settleEffects } from '../testing/settle-effects';
import * as Wheel from './parts';
import { type UseWheelTimeProps, useWheelTime } from './use-wheel-time';

const FIELD_NAME = 'birthTime';

type ProbeSnapshot = {
  readonly minuteLabels: readonly string[];
  readonly value: string | null;
};

type ControlledProbeProps = Omit<UseWheelTimeProps, 'value'> & {
  readonly initialValue: string | null;
};

type ErrorBoundaryState = { readonly error: unknown };

// Goal: 앱이 하듯 useWheelTime 결과로 Wheel 부품을 그림. 열 조작·숨은 입력을 실제 DOM으로 검증함
const WheelTimeColumns = (props: UseWheelTimeProps) => {
  const wheelTime = useWheelTime(props);
  const snapshot: ProbeSnapshot = {
    minuteLabels: wheelTime.columns.minutes.map((option) => option.label),
    value: wheelTime.value,
  };
  return (
    <>
      <Wheel.Root aria-label="Time" {...wheelTime.getWheelRootProps()}>
        <Wheel.Column
          label={wheelTime.labels.hour}
          options={wheelTime.columns.hours}
          value={wheelTime.fields.hour}
          onValueChange={wheelTime.selectHour}
        />
        <Wheel.Column
          label={wheelTime.labels.minute}
          options={wheelTime.columns.minutes}
          value={wheelTime.fields.minute}
          onValueChange={wheelTime.selectMinute}
        />
        <Wheel.HiddenInput {...wheelTime.getHiddenInputProps()} />
      </Wheel.Root>
      <output>{JSON.stringify(snapshot)}</output>
    </>
  );
};

const ControlledProbe = ({ initialValue, onValueChange, ...props }: ControlledProbeProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <WheelTimeColumns
        {...props}
        value={value}
        onValueChange={(next, details) => {
          setValue(next);
          onValueChange?.(next, details);
        }}
      />
      <button type="button" onClick={() => setValue(null)}>
        Clear
      </button>
    </>
  );
};

class ErrorBoundary extends Component<{ readonly children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override render(): ReactNode {
    return this.state.error === null ? this.props.children : <p>failed</p>;
  }
}

const renderInForm = (element: ReactNode) =>
  render(
    <KoreanProvider>
      <form aria-label="Birth">{element}</form>
    </KoreanProvider>,
  );

type Screen = Awaited<ReturnType<typeof renderInForm>>;

const hourColumnOf = (screen: Screen) => screen.getByRole('spinbutton', { name: ko.labels.hour });
const minuteColumnOf = (screen: Screen) => screen.getByRole('spinbutton', { name: ko.labels.minute });
const submittedValueOf = (screen: Screen) => new FormData(formElementOf(screen.getByRole('form'))).get(FIELD_NAME);

const readProbe = (screen: Screen): ProbeSnapshot =>
  // as: 프로브가 그린 JSON은 ProbeSnapshot 모양임
  JSON.parse(screen.getByRole('status').element().textContent ?? '{}') as ProbeSnapshot;

const pressOn = async (column: ReturnType<typeof hourColumnOf>, key: string): Promise<void> => {
  await focusDirectly(column);
  await userEvent.keyboard(key);
};

describe('useWheelTime', () => {
  describe('empty value', () => {
    it('rests at 12:00 without reporting a value', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(<WheelTimeColumns name={FIELD_NAME} onValueChange={onValueChange} />);
      await settleEffects();

      await expect.element(hourColumnOf(screen)).toHaveAttribute('aria-valuetext', '12');
      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '00');
      expect(submittedValueOf(screen)).toBe('');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('commits the shown time on the first selection', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(<WheelTimeColumns onValueChange={onValueChange} />);

      await pressOn(hourColumnOf(screen), '{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['13:00', { validity: VALID }]]);
    });
  });

  describe('minuteStep', () => {
    it('lists minutes at the step', async () => {
      const screen = await renderInForm(<WheelTimeColumns minuteStep={5} />);

      expect(readProbe(screen).minuteLabels).toEqual([
        '00',
        '05',
        '10',
        '15',
        '20',
        '25',
        '30',
        '35',
        '40',
        '45',
        '50',
        '55',
      ]);
    });

    it('shows an off-step value at the step before without changing it', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(
        <WheelTimeColumns name={FIELD_NAME} defaultValue="09:07" minuteStep={5} onValueChange={onValueChange} />,
      );
      await settleEffects();

      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '05');
      expect(submittedValueOf(screen)).toBe('09:07');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('commits the floored minute when the hour turns', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(
        <WheelTimeColumns defaultValue="09:07" minuteStep={5} onValueChange={onValueChange} />,
      );

      await pressOn(hourColumnOf(screen), '{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['10:05', { validity: VALID }]]);
    });

    it('re-floors without a callback when the step changes while mounted', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(
        <WheelTimeColumns name={FIELD_NAME} defaultValue="09:07" minuteStep={1} onValueChange={onValueChange} />,
      );
      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '07');

      await screen.rerender(
        <KoreanProvider>
          <form aria-label="Birth">
            <WheelTimeColumns name={FIELD_NAME} defaultValue="09:07" minuteStep={5} onValueChange={onValueChange} />
          </form>
        </KoreanProvider>,
      );
      await settleEffects();

      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '05');
      expect(submittedValueOf(screen)).toBe('09:07');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('offers only 00 when the step is 60', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(
        <WheelTimeColumns defaultValue="09:00" minuteStep={60} onValueChange={onValueChange} />,
      );
      expect(readProbe(screen).minuteLabels).toEqual(['00']);

      await pressOn(hourColumnOf(screen), '{ArrowDown}');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['10:00', { validity: VALID }]]);
    });

    it('throws for a step that does not divide 60', async () => {
      const onError = vi.fn();
      vi.spyOn(console, 'error').mockImplementation(onError);
      onTestFinished(() => {
        vi.restoreAllMocks();
      });
      const screen = await render(
        <ErrorBoundary>
          <KoreanProvider>
            <WheelTimeColumns minuteStep={7} />
          </KoreanProvider>
        </ErrorBoundary>,
      );

      await expect.element(screen.getByText('failed')).toBeInTheDocument();
      expect(onError.mock.calls.flat().some((argument) => argument instanceof LunisolarPickerError)).toBe(true);
    });
  });

  describe('controlled value', () => {
    it('reports a malformed value through onInvalidValue once', async () => {
      const onInvalidValue = vi.fn();
      await renderInForm(<WheelTimeColumns value="25:00" onInvalidValue={onInvalidValue} />);
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['25:00', 'invalid-time']]);
    });

    it('ignores defaultValue while the parent controls an empty value', async () => {
      const screen = await renderInForm(<WheelTimeColumns name={FIELD_NAME} value={null} defaultValue="09:00" />);
      await settleEffects();

      expect(submittedValueOf(screen)).toBe('');
      await expect.element(hourColumnOf(screen)).toHaveAttribute('aria-valuetext', '12');
    });

    it('treats 24:00 as malformed', async () => {
      const onInvalidValue = vi.fn();
      const screen = await renderInForm(<WheelTimeColumns value="24:00" onInvalidValue={onInvalidValue} />);
      await settleEffects();

      expect(onInvalidValue.mock.calls).toEqual([['24:00', 'invalid-time']]);
      await expect.element(hourColumnOf(screen)).toHaveAttribute('aria-valuetext', '12');
      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '00');
    });

    it('keeps the wheel position when the parent clears the value, without reporting it', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(<ControlledProbe initialValue="09:30" onValueChange={onValueChange} />);

      await screen.getByRole('button', { name: 'Clear' }).click();

      await expect.poll(() => readProbe(screen).value).toBeNull();
      await settleEffects();
      await expect.element(hourColumnOf(screen)).toHaveAttribute('aria-valuetext', '09');
      await expect.element(minuteColumnOf(screen)).toHaveAttribute('aria-valuetext', '30');
      expect(onValueChange.mock.calls).toEqual([]);
    });
  });

  describe('hour column', () => {
    it('stops at 23 instead of wrapping', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInForm(<WheelTimeColumns value="23:00" onValueChange={onValueChange} />);

      await pressOn(hourColumnOf(screen), '{ArrowDown}');
      await settleEffects();

      await expect.element(hourColumnOf(screen)).toHaveAttribute('aria-valuetext', '23');
      expect(onValueChange.mock.calls).toEqual([]);
    });

    it('exposes spinbuttons named by the locale hour and minute labels', async () => {
      const screen = await renderInForm(<WheelTimeColumns />);

      await expect.element(hourColumnOf(screen)).toBeInTheDocument();
      await expect.element(minuteColumnOf(screen)).toBeInTheDocument();
    });
  });
});
