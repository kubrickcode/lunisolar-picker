import { brandEpochDay, type DateRangeValue, formatDate, isSameRange } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { type FormEvent, type ReactElement, useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Calendar, type DateRangeInput } from '../index';
import { clickToFocus } from '../testing/click-to-focus';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { dayLabel, epochDayAt, FIXED_TODAY, KoreanProvider } from '../testing/korean-fixture';
import { endsWith, openSheet, pressWithKeyboard } from '../testing/picker-fixture';
import { dispatchPointer } from '../testing/pointer';
import { settleEffects } from '../testing/settle-effects';
import {
  DateRangePicker,
  MonthPicker,
  TimePicker,
  usePickerSelection,
  WheelDatePicker,
  WheelTimePicker,
} from './index';

// Goal: 소비 앱 세 곳(back-office, web-console, saju-pictures)이 지금 쓰는 기능을 공개 진입점(`.`, `/pickers`, core·calendar)만으로 다시 만들 수 있는지 고정함 (스펙 1.1 교체 가능성)
// Constraint: 앱 코드처럼 picker·부품은 공개 진입점에서만 import함. testing 헬퍼는 오늘 고정과 브라우저 조작용

const APPLIED_RANGE_ID = 'applied-range';
const BIRTH_DATE_LABEL = '생년월일';
const BIRTH_DATE_NAME = 'birthDate';
const BIRTH_FORM_LABEL = '출생 정보';
const BIRTH_TIME_LABEL = '태어난 시각';
const BIRTH_TIME_NAME = 'birthTime';
const HOLIDAYS: Readonly<Record<string, string>> = { '2026-10-09': '한글날' };
const HOLIDAY_DOT_ID = 'holiday-dot';
const JOIN_ROOM_LABEL = '방 참가';
const LUNAR_TOGGLE_LABEL = '음력으로 입력';
const NOVEMBER_HEADING = ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory');
const OCTOBER_HEADING = ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory');
const OUTSIDE_BUTTON_LABEL = '바깥';
const RECENT_DAY_COUNTS = [1, 3, 7] as const;
const RESERVATION_FORM_LABEL = '예약 조회';
const STATS_MAX_DAYS = 3;
const TIME_UNKNOWN_LABEL = '모름';
const SUBMIT_LABEL = '조회';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

type BirthDateFormProps = {
  readonly defaultValue?: string | undefined;
  readonly onSubmitBirthDate: (birthDate: FormDataEntryValue | null) => void;
  readonly onValueChange: (value: string | null) => void;
};

type BirthTimeFormProps = {
  readonly onSubmitBirthTime: (birthTime: FormDataEntryValue | null) => void;
  readonly onValueChange: (value: string | null) => void;
};

type ControllerReservationFormProps = {
  readonly onBlur: () => void;
  readonly onSearch: (period: DateRangeInput) => void;
};

type JoinRoomDialogProps = {
  readonly onSubmitBirth: (birthDate: FormDataEntryValue | null, birthTime: FormDataEntryValue | null) => void;
};

type LunarToggleWheelProps = {
  readonly onValueChange: (value: string | null) => void;
};

type RecentDaysPresetsProps = {
  readonly maxDays: number;
};

type ReservationFormProps = {
  readonly onSearch: (query: Readonly<Record<string, FormDataEntryValue>>) => void;
};

type Screen = Awaited<ReturnType<typeof render>>;

// Goal: back-office 통계 화면. 확인을 눌러야 조회 범위가 바뀌고, 바뀐 범위로 화면을 다시 그림 (preflight 1.4)
const BackOfficeStats = (): ReactElement => {
  const [appliedRange, setAppliedRange] = useState<DateRangeInput | null>(null);
  return (
    <>
      <DateRangePicker
        presentation="popover"
        commitMode="confirm"
        max={FIXED_TODAY}
        maxDays={STATS_MAX_DAYS}
        limitMode="flag"
        presets={<RecentDaysPresets maxDays={STATS_MAX_DAYS} />}
        footer={<RangeWarning />}
        value={appliedRange}
        onValueChange={setAppliedRange}
      />
      <output data-testid={APPLIED_RANGE_ID}>
        {appliedRange ? `${appliedRange.start}~${appliedRange.end ?? ''}` : ''}
      </output>
    </>
  );
};

// Goal: saju-pictures 모바일 입력. 음력 생년월일을 시트 휠로 고르고 일반 form으로 제출함 (Astro island)
const BirthDateForm = ({ defaultValue, onSubmitBirthDate, onValueChange }: BirthDateFormProps): ReactElement => (
  <form
    aria-label={BIRTH_FORM_LABEL}
    onSubmit={(event) => {
      event.preventDefault();
      onSubmitBirthDate(new FormData(event.currentTarget).get(BIRTH_DATE_NAME));
    }}
  >
    <WheelDatePicker
      presentation="sheet"
      aria-label={BIRTH_DATE_LABEL}
      name={BIRTH_DATE_NAME}
      required
      entryCalendar="dangi"
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    />
    <button type="submit">{SUBMIT_LABEL}</button>
  </form>
);

// Goal: saju-pictures 생시 입력. "모름"은 picker 칸이 아니라 앱이 그린 체크박스로, 켜면 시각 휠을 끄고 제출에서 뺌 (스펙 1.1)
const BirthTimeForm = ({ onSubmitBirthTime, onValueChange }: BirthTimeFormProps): ReactElement => {
  const [isTimeUnknown, setTimeUnknown] = useState(false);
  return (
    <form
      aria-label={BIRTH_FORM_LABEL}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitBirthTime(new FormData(event.currentTarget).get(BIRTH_TIME_NAME));
      }}
    >
      <WheelTimePicker
        presentation="sheet"
        aria-label={BIRTH_TIME_LABEL}
        name={BIRTH_TIME_NAME}
        minuteStep={1}
        required
        disabled={isTimeUnknown}
        onValueChange={onValueChange}
      />
      <label>
        <input type="checkbox" checked={isTimeUnknown} onChange={(event) => setTimeUnknown(event.target.checked)} />
        {TIME_UNKNOWN_LABEL}
      </label>
      <button type="submit">{SUBMIT_LABEL}</button>
    </form>
  );
};

// Goal: back-office의 react-hook-form Controller 연동. field.value·onChange·onBlur·ref를 그대로 넘기고, 제출은 폼 상태의 값을 씀
const ControllerReservationForm = ({ onBlur, onSearch }: ControllerReservationFormProps): ReactElement => {
  const [period, setPeriod] = useState<DateRangeInput | null>(null);
  const periodRef = useRef<{ focus(): void }>(null);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (period?.end == null) {
      periodRef.current?.focus();
      return;
    }
    onSearch(period);
  };
  return (
    <form aria-label={RESERVATION_FORM_LABEL} noValidate onSubmit={submit}>
      <DateRangePicker
        presentation="popover"
        ref={periodRef}
        value={period}
        onValueChange={setPeriod}
        onBlur={onBlur}
      />
      <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
      <button type="submit">{SUBMIT_LABEL}</button>
    </form>
  );
};

// Goal: saju-pictures 방 참가 시트. showModal()로 띄운 네이티브 dialog 안에서 생년월일·생시 시트 휠을 씀(ModalSheet, transform 없음)
const JoinRoomDialog = ({ onSubmitBirth }: JoinRoomDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog ref={dialogRef} aria-label={JOIN_ROOM_LABEL}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSubmitBirth(formData.get(BIRTH_DATE_NAME), formData.get(BIRTH_TIME_NAME));
        }}
      >
        <WheelDatePicker
          presentation="sheet"
          aria-label={BIRTH_DATE_LABEL}
          name={BIRTH_DATE_NAME}
          required
          entryCalendar="dangi"
          defaultValue="1990-06-22[u-ca=dangi]"
        />
        <WheelTimePicker presentation="sheet" aria-label={BIRTH_TIME_LABEL} name={BIRTH_TIME_NAME} />
        <button type="submit">{SUBMIT_LABEL}</button>
      </form>
    </dialog>
  );
};

// Goal: saju-pictures의 양력·음력 전환은 앱이 그린 버튼이 entryCalendar를 바꿔 휠 역법을 바꿈
const LunarToggleWheel = ({ onValueChange }: LunarToggleWheelProps): ReactElement => {
  const [isLunar, setLunar] = useState(false);
  const [birthDate, setBirthDate] = useState<string | null>('1990-06-22');
  return (
    <>
      <button type="button" aria-pressed={isLunar} onClick={() => setLunar(!isLunar)}>
        {LUNAR_TOGGLE_LABEL}
      </button>
      <WheelDatePicker
        aria-label={BIRTH_DATE_LABEL}
        entryCalendar={isLunar ? 'dangi' : 'gregory'}
        value={birthDate}
        onValueChange={(next) => {
          setBirthDate(next);
          onValueChange(next);
        }}
      />
    </>
  );
};

// Goal: 경고 문구는 앱 몫이라(스펙 1.1) 앱이 picker의 유효성으로 직접 그림
const RangeWarning = (): ReactElement | null => {
  const { validity } = usePickerSelection();
  return validity.isValid ? null : (
    <p role="alert">{validity.reasons.map((reason) => ko.labels.validation[reason]).join(' ')}</p>
  );
};

// Goal: web-console·back-office의 '최근 N일' 프리셋. 최대 기간을 넘는 프리셋은 앱이 비활성으로, 보이는 범위와 같으면 눌린 상태로 그림
const RecentDaysPresets = ({ maxDays }: RecentDaysPresetsProps): ReactElement => {
  const selection = usePickerSelection();
  return (
    <>
      {RECENT_DAY_COUNTS.map((dayCount) => {
        const range = recentRange(dayCount);
        const isAllowed = validateRange(range, { max: FIXED_TODAY, maxDays, limitMode: 'flag' }).isValid;
        return (
          <button
            key={dayCount}
            type="button"
            disabled={!isAllowed}
            aria-pressed={isSameRange(selection.draftRange, range)}
            onClick={() => selection.setRange(range)}
          >
            {`최근 ${dayCount}일`}
          </button>
        );
      })}
    </>
  );
};

// Goal: back-office의 react-hook-form 연동. 제출 때 비어 있으면 ref로 기간 칸에 포커스하고(shouldFocusError), 값은 폼 이름으로 모음
const ReservationForm = ({ onSearch }: ReservationFormProps): ReactElement => {
  const rangeRef = useRef<{ focus(): void }>(null);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!formData.get('from')) {
      rangeRef.current?.focus();
      return;
    }
    onSearch(Object.fromEntries(formData));
  };
  return (
    <form aria-label={RESERVATION_FORM_LABEL} noValidate onSubmit={submit}>
      <DateRangePicker presentation="popover" ref={rangeRef} startName="from" endName="to" required />
      <TimePicker presentation="popover" name="at" />
      <button type="submit">{SUBMIT_LABEL}</button>
    </form>
  );
};

const dayButtonIn = (screen: Screen, heading: string, isoDate: string): HTMLElement => {
  const element = dayIn(screen, heading, isoDate).element();
  if (!(element instanceof HTMLElement)) throw new Error(`day ${isoDate} should render a button`);
  return element;
};

const dayIn = (screen: Screen, heading: string, isoDate: string) =>
  screen.getByRole('grid', { name: heading }).getByRole('button', { name: dayLabel(isoDate) });

// Goal: 앱이 '최근 N일' 범위를 calendar 공개 함수로 계산함
const recentRange = (dayCount: number): DateRangeValue => {
  const end = epochDayAt(FIXED_TODAY);
  const start = formatDate(brandEpochDay(end - dayCount + 1));
  const endValue = formatDate(end);
  if (!start.isOk || !endValue.isOk) throw new Error('recent range must stay inside the Gregorian range');
  return { start: start.value, end: endValue.value };
};

const renderInApp = (element: ReactElement): Promise<Screen> => render(<KoreanProvider>{element}</KoreanProvider>);

// Goal: saju-pictures는 음력(dangi)을 켠 Provider 아래에서 씀
const renderInLunarApp = (element: ReactElement): Promise<Screen> =>
  render(<KoreanProvider hasLunar>{element}</KoreanProvider>);

describe('consumer parity', () => {
  describe('back-office', () => {
    it('stats: applies a recent-day preset within the maximum only after confirm', async () => {
      const screen = await renderInApp(<BackOfficeStats />);

      await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
      await expect.element(screen.getByRole('button', { name: '최근 7일' })).toBeDisabled();
      await screen.getByRole('button', { name: '최근 3일' }).click();
      await expect.element(screen.getByRole('button', { name: '최근 3일' })).toHaveAttribute('aria-pressed', 'true');
      await expect.element(screen.getByTestId(APPLIED_RANGE_ID)).toHaveTextContent('');
      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      const applied = recentRange(STATS_MAX_DAYS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await expect.element(screen.getByTestId(APPLIED_RANGE_ID)).toHaveTextContent(`${applied.start}~${applied.end}`);
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.day }).last()).toHaveTextContent('14');
    });

    it('reservation form: focuses the empty range on submit, then submits range and time by name', async () => {
      const onSearch = vi.fn();
      const screen = await renderInApp(<ReservationForm onSearch={onSearch} />);
      const submitButton = screen.getByRole('button', { name: SUBMIT_LABEL });

      await submitButton.click();
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.year }).first()).toHaveFocus();
      await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-13') }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-17') }).click();
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.hour }));
      await userEvent.keyboard('1830');
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.minute })).toHaveTextContent('30');
      await submitButton.click();

      expect(onSearch.mock.calls).toEqual([[{ from: '2026-10-13', to: '2026-10-17', at: '18:30' }]]);
    });

    it('controller form: reports leaving the picker once and submits the controlled range', async () => {
      const onBlur = vi.fn();
      const onSearch = vi.fn();
      const screen = await renderInApp(<ControllerReservationForm onBlur={onBlur} onSearch={onSearch} />);
      const startYear = screen.getByRole('spinbutton', { name: ko.labels.year }).first();

      await clickToFocus(startYear);
      await clickToFocus(screen.getByRole('spinbutton', { name: ko.labels.month }).first());
      await settleEffects();
      expect(onBlur).not.toHaveBeenCalled();
      await focusDirectly(screen.getByRole('button', { name: OUTSIDE_BUTTON_LABEL }));
      await expect.poll(() => onBlur.mock.calls.length).toBe(1);

      await screen.getByRole('button', { name: SUBMIT_LABEL }).click();
      await expect.element(startYear).toHaveFocus();
      await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-13') }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-17') }).click();
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await screen.getByRole('button', { name: SUBMIT_LABEL }).click();

      expect(onSearch.mock.calls).toEqual([[{ start: '2026-10-13', end: '2026-10-17' }]]);
    });

    it('range picker: jumps back to the current month after browsing ahead', async () => {
      const screen = await renderInApp(<DateRangePicker presentation="popover" defaultOpen />);

      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await screen.getByRole('button', { name: ko.labels.nextMonth }).click();
      await expect.element(screen.getByRole('grid')).not.toHaveAccessibleName(OCTOBER_HEADING);
      await screen.getByRole('button', { name: ko.labels.today }).click();

      await expect.element(screen.getByRole('grid')).toHaveAccessibleName(OCTOBER_HEADING);
    });
  });

  describe('web-console', () => {
    it('report: warns about an over-long range and keeps confirm blocked', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInApp(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          maxDays={STATS_MAX_DAYS}
          limitMode="flag"
          footer={<RangeWarning />}
          onValueChange={onValueChange}
        />,
      );

      await screen.getByRole('button', { name: ko.labels.chooseDateRange }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-01') }).click();
      await screen.getByRole('button', { name: dayLabel('2026-10-10') }).click();

      await expect.element(screen.getByRole('alert')).toHaveTextContent(ko.labels.validation['range-too-long']);
      const confirmButton = screen.getByRole('button', { name: ko.labels.confirm });
      await expect.element(confirmButton).toBeDisabled();
      // Constraint: 비활성 버튼은 포커스를 받지 않아 키로 누를 수 없으므로 실행 가능성 검사를 건너뛰고 눌러 봄
      await confirmButton.click({ force: true });
      await settleEffects();

      expect(onValueChange).not.toHaveBeenCalled();
      await expect.element(screen.getByRole('dialog')).toBeVisible();
    });

    it('schedule: shows two months side by side with app holiday marks and names', async () => {
      const screen = await renderInApp(
        <DateRangePicker
          presentation="popover"
          defaultOpen
          numberOfMonths={2}
          getCellLabel={(cell) => HOLIDAYS[cell.date]}
          renderCell={(info) => (
            <>
              {info.day}
              {HOLIDAYS[info.date] ? <i data-testid={HOLIDAY_DOT_ID} /> : null}
            </>
          )}
        />,
      );

      await expect.element(screen.getByRole('grid', { name: NOVEMBER_HEADING })).toBeVisible();
      expect(screen.getByRole('grid').all()).toHaveLength(2);
      await expect.element(screen.getByRole('button', { name: `${dayLabel('2026-10-09')}, 한글날` })).toBeVisible();
      expect(screen.getByTestId(HOLIDAY_DOT_ID).all()).toHaveLength(1);
    });

    it('schedule: drags a range across the month boundary and applies it on confirm', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInApp(
        <DateRangePicker
          presentation="popover"
          commitMode="confirm"
          defaultOpen
          numberOfMonths={2}
          onValueChange={onValueChange}
        />,
      );
      await expect.element(screen.getByRole('grid', { name: NOVEMBER_HEADING })).toBeVisible();

      dispatchPointer(dayButtonIn(screen, OCTOBER_HEADING, '2026-10-28'), 'pointerdown');
      dispatchPointer(dayButtonIn(screen, NOVEMBER_HEADING, '2026-11-03'), 'pointerover');
      dispatchPointer(document, 'pointerup');
      await expect
        .element(
          screen.getByRole('grid', { name: NOVEMBER_HEADING }).getByRole('gridcell', { name: dayLabel('2026-11-03') }),
        )
        .toHaveAttribute('aria-selected', 'true');
      expect(onValueChange).not.toHaveBeenCalled();
      await screen.getByRole('button', { name: ko.labels.confirm }).click();

      expect(onValueChange).toHaveBeenCalledWith({ start: '2026-10-28', end: '2026-11-03' }, VALID_DETAILS);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('BI dashboard: picks a month within the allowed months', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInApp(
        <MonthPicker presentation="popover" min="2026-01" max="2026-10" onValueChange={onValueChange} />,
      );

      await screen.getByRole('button', { name: endsWith(ko.labels.chooseMonth) }).click();
      await expect
        .element(screen.getByRole('button', { name: ko.formatMonthName({ year: 2026, monthCode: 'M11' }, 'gregory') }))
        .toBeDisabled();
      await screen
        .getByRole('button', { name: ko.formatMonthName({ year: 2026, monthCode: 'M09' }, 'gregory') })
        .click();

      expect(onValueChange).toHaveBeenCalledWith('2026-09', VALID_DETAILS);
      await expect
        .element(screen.getByRole('button', { name: endsWith(ko.labels.chooseMonth) }))
        .toHaveTextContent(ko.formatHeading({ year: 2026, monthCode: 'M09' }, 'gregory'));
    });

    it('timetable: offers five-minute steps up to 24:00 and picks the end of day', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInApp(
        <TimePicker presentation="popover" minuteStep={5} isEndOfDayAllowed onValueChange={onValueChange} />,
      );
      const trigger = screen.getByRole('button', { name: ko.labels.chooseTime });
      await focusOnce(trigger);

      await trigger.click();
      expect(screen.getByRole('option').all()).toHaveLength(289);
      await focusDirectly(screen.getByRole('option').first());
      // Constraint: 289개 목록의 끝 항목은 화면 밖이라 클릭 대신 키보드로 고름 (preflight 2.10)
      await userEvent.keyboard('{End}{Enter}');

      expect(onValueChange).toHaveBeenCalledWith('24:00', VALID_DETAILS);
      await expect.element(screen.getByRole('spinbutton', { name: ko.labels.hour })).toHaveTextContent('24');
    });
  });

  describe('saju-pictures', () => {
    it('picks a lunar leap-month birth date on the sheet wheel and submits it', async () => {
      const onSubmitBirthDate = vi.fn();
      const onValueChange = vi.fn();
      const screen = await renderInLunarApp(
        <BirthDateForm
          defaultValue="1990-06-22[u-ca=dangi]"
          onSubmitBirthDate={onSubmitBirthDate}
          onValueChange={onValueChange}
        />,
      );

      await openSheet({
        trigger: screen.getByRole('button', { name: endsWith(BIRTH_DATE_LABEL) }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      const monthColumn = screen.getByRole('spinbutton', { name: ko.labels.month });
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.day }))
        .toHaveAttribute('aria-valuetext', '30');
      await focusDirectly(monthColumn);
      await userEvent.keyboard('{ArrowDown}');
      // Constraint: 휠은 정착 애니메이션이 끝난 뒤 값을 확정하므로 보이는 글자로 기다림 (preflight 2.11)
      await expect.element(monthColumn).toHaveAttribute('aria-valuetext', '윤5월');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.day }))
        .toHaveAttribute('aria-valuetext', '29');
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await screen.getByRole('button', { name: SUBMIT_LABEL }).click();

      expect(onValueChange.mock.calls).toEqual([['1990-07-21[u-ca=dangi]', VALID_DETAILS]]);
      expect(onSubmitBirthDate.mock.calls).toEqual([['1990-07-21[u-ca=dangi]']]);
    });

    it('blocks the required birth date until the lunar date shown on the sheet is confirmed', async () => {
      const onSubmitBirthDate = vi.fn();
      const onValueChange = vi.fn();
      const screen = await renderInLunarApp(
        <BirthDateForm onSubmitBirthDate={onSubmitBirthDate} onValueChange={onValueChange} />,
      );
      const form = formElementOf(screen.getByRole('form', { name: BIRTH_FORM_LABEL }));
      expect(form.checkValidity()).toBe(false);

      await openSheet({
        trigger: screen.getByRole('button', { name: endsWith(BIRTH_DATE_LABEL) }),
        initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }),
      });
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();

      expect(onValueChange.mock.calls).toEqual([[`${FIXED_TODAY}[u-ca=dangi]`, VALID_DETAILS]]);
      expect(form.checkValidity()).toBe(true);
      await screen.getByRole('button', { name: SUBMIT_LABEL }).click();
      expect(onSubmitBirthDate.mock.calls).toEqual([[`${FIXED_TODAY}[u-ca=dangi]`]]);
    });

    it('birth time: an app-drawn "time unknown" checkbox toggles disabled and keeps the time', async () => {
      const onSubmitBirthTime = vi.fn();
      const onValueChange = vi.fn();
      const screen = await renderInApp(
        <BirthTimeForm onSubmitBirthTime={onSubmitBirthTime} onValueChange={onValueChange} />,
      );
      const trigger = screen.getByRole('button', { name: endsWith(BIRTH_TIME_LABEL) });
      const submitButton = screen.getByRole('button', { name: SUBMIT_LABEL });
      const unknownCheckbox = screen.getByRole('checkbox', { name: TIME_UNKNOWN_LABEL });

      await openSheet({ trigger, initialFocus: screen.getByRole('spinbutton', { name: ko.labels.hour }) });
      const hourColumn = screen.getByRole('spinbutton', { name: ko.labels.hour });
      await focusDirectly(hourColumn);
      await userEvent.keyboard('{ArrowDown}');
      // Constraint: 휠은 정착 애니메이션이 끝난 뒤 값을 확정하므로 보이는 글자로 기다림 (preflight 2.11)
      await expect.element(hourColumn).toHaveAttribute('aria-valuetext', '13');
      await settleEffects();
      await pressWithKeyboard(screen.getByRole('button', { name: ko.labels.confirm }));
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      await submitButton.click();
      expect(onSubmitBirthTime.mock.calls).toEqual([['13:00']]);

      await unknownCheckbox.click();
      await expect.element(trigger).toBeDisabled();
      await submitButton.click();
      expect(onSubmitBirthTime.mock.calls).toEqual([['13:00'], [null]]);

      await unknownCheckbox.click();
      await expect.element(trigger).toHaveTextContent('13:00');
      await submitButton.click();
      expect(onSubmitBirthTime.mock.calls).toEqual([['13:00'], [null], ['13:00']]);
      expect(onValueChange.mock.calls).toEqual([['13:00', VALID_DETAILS]]);
    });

    it('join-room dialog: picks birth date and time on sheets drawn above the modal dialog, and Escape closes only the sheet', async () => {
      const onSubmitBirth = vi.fn();
      const screen = await renderInLunarApp(<JoinRoomDialog onSubmitBirth={onSubmitBirth} />);
      const joinDialog = screen.getByRole('dialog', { name: JOIN_ROOM_LABEL }).element();
      if (!(joinDialog instanceof HTMLDialogElement)) throw new Error('join room should render a dialog element');
      const dateTrigger = screen.getByRole('button', { name: endsWith(BIRTH_DATE_LABEL) });
      const timeTrigger = screen.getByRole('button', { name: endsWith(BIRTH_TIME_LABEL) });
      const dateSheet = screen.getByRole('dialog', { name: BIRTH_DATE_LABEL });
      const timeSheet = screen.getByRole('dialog', { name: BIRTH_TIME_LABEL });

      await openSheet({ trigger: dateTrigger, initialFocus: screen.getByRole('spinbutton', { name: ko.labels.year }) });
      expect(document.querySelector('[data-lsp-part="sheet"]')?.closest('dialog')).toBe(joinDialog);
      const monthColumn = screen.getByRole('spinbutton', { name: ko.labels.month });
      await focusDirectly(monthColumn);
      await userEvent.keyboard('{ArrowDown}');
      // Constraint: 휠은 정착 애니메이션이 끝난 뒤 값을 확정하므로 보이는 글자로 기다림 (preflight 2.11)
      await expect.element(monthColumn).toHaveAttribute('aria-valuetext', '윤5월');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.day }))
        .toHaveAttribute('aria-valuetext', '29');
      // Constraint: 증상이 dialog에 가로막힌 포인터 입력이므로 확인은 키보드가 아니라 포인터로 누름
      await screen.getByRole('button', { name: ko.labels.confirm }).click();
      await expect.element(dateSheet).not.toBeInTheDocument();
      await expect.element(dateTrigger).toHaveFocus();

      await openSheet({ trigger: timeTrigger, initialFocus: screen.getByRole('spinbutton', { name: ko.labels.hour }) });
      const hourColumn = screen.getByRole('spinbutton', { name: ko.labels.hour });
      await focusDirectly(hourColumn);
      await userEvent.keyboard('{ArrowDown}');
      await expect.element(hourColumn).toHaveAttribute('aria-valuetext', '13');
      await settleEffects();
      await screen.getByRole('button', { name: ko.labels.confirm }).click();
      await expect.element(timeSheet).not.toBeInTheDocument();

      await openSheet({ trigger: timeTrigger, initialFocus: screen.getByRole('spinbutton', { name: ko.labels.hour }) });
      await userEvent.keyboard('{Escape}');
      await expect.element(timeSheet).not.toBeInTheDocument();
      expect(joinDialog.open).toBe(true);
      await expect.element(timeTrigger).toHaveFocus();

      await screen.getByRole('button', { name: SUBMIT_LABEL }).click();
      expect(onSubmitBirth.mock.calls).toEqual([['1990-07-21[u-ca=dangi]', '13:00']]);

      // Goal: picker가 닫힌 상태의 Esc는 바깥 dialog를 닫아야, 위 "Esc 뒤 dialog가 열려 있음"이 이 브라우저에서 의미를 가짐
      await userEvent.keyboard('{Escape}');
      await expect.poll(() => joinDialog.open).toBe(false);
    });

    it('switches the inline wheel to lunar from an app toggle and keeps the same birth date', async () => {
      const onValueChange = vi.fn();
      const screen = await renderInLunarApp(<LunarToggleWheel onValueChange={onValueChange} />);
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.month }))
        .toHaveAttribute('aria-valuetext', '6월');

      await screen.getByRole('button', { name: LUNAR_TOGGLE_LABEL }).click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([['1990-06-22[u-ca=dangi]']]);
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.month }))
        .toHaveAttribute('aria-valuetext', '5월');
      await expect
        .element(screen.getByRole('spinbutton', { name: ko.labels.day }))
        .toHaveAttribute('aria-valuetext', '30');
    });
  });

  it('standalone calendar keeps its selection inside an app layout', async () => {
    const screen = await renderInApp(
      <main>
        <Calendar.Root defaultValue="2026-10-20" />
      </main>,
    );

    await expect
      .element(screen.getByRole('gridcell', { name: dayLabel('2026-10-20') }))
      .toHaveAttribute('aria-selected', 'true');
  });
});
