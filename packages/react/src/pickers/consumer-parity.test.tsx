import { brandEpochDay, type DateRangeValue, formatDate, isSameRange } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { type FormEvent, type ReactElement, useRef, useState } from 'react';
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
import { DateRangePicker, MonthPicker, TimePicker, usePickerSelection, WheelDatePicker } from './index';

// Goal: 소비 앱 세 곳(back-office, web-console, saju-pictures)이 지금 쓰는 기능을 공개 진입점(`.`, `/pickers`, core·calendar)만으로 다시 만들 수 있는지 고정함 (스펙 1.1 교체 가능성)
// Constraint: 앱 코드처럼 picker·부품은 공개 진입점에서만 import함. testing 헬퍼는 오늘 고정과 브라우저 조작용

const APPLIED_RANGE_ID = 'applied-range';
const BIRTH_DATE_LABEL = '생년월일';
const BIRTH_DATE_NAME = 'birthDate';
const BIRTH_FORM_LABEL = '출생 정보';
const HOLIDAYS: Readonly<Record<string, string>> = { '2026-10-09': '한글날' };
const HOLIDAY_DOT_ID = 'holiday-dot';
const LUNAR_TOGGLE_LABEL = '음력으로 입력';
const NOVEMBER_HEADING = ko.formatHeading({ year: 2026, monthCode: 'M11' }, 'gregory');
const OCTOBER_HEADING = ko.formatHeading({ year: 2026, monthCode: 'M10' }, 'gregory');
const RECENT_DAY_COUNTS = [1, 3, 7] as const;
const RESERVATION_FORM_LABEL = '예약 조회';
const STATS_MAX_DAYS = 3;
const SUBMIT_LABEL = '조회';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

type BirthDateFormProps = {
  readonly onSubmitBirthDate: (birthDate: FormDataEntryValue | null) => void;
  readonly onValueChange: (value: string | null) => void;
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
const BirthDateForm = ({ onSubmitBirthDate, onValueChange }: BirthDateFormProps): ReactElement => (
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
      defaultValue="1990-06-22[u-ca=dangi]"
      onValueChange={onValueChange}
    />
    <button type="submit">{SUBMIT_LABEL}</button>
  </form>
);

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
      await expect.element(screen.getByRole('button', { name: ko.labels.confirm })).toBeDisabled();
      expect(onValueChange).not.toHaveBeenCalled();
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
        <BirthDateForm onSubmitBirthDate={onSubmitBirthDate} onValueChange={onValueChange} />,
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
      expect(formElementOf(screen.getByRole('form', { name: BIRTH_FORM_LABEL })).checkValidity()).toBe(true);
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
