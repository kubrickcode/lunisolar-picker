import { addDays, type DateRangeValue, type DateString, formatDate, isSameRange } from '@lunisolar-picker/calendar';
import { type Validity, validateRange } from '@lunisolar-picker/core';
import { useToday } from '@lunisolar-picker/react';
import { DateRangePicker, usePickerSelection } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const MAX_DAYS = 14;
const PRESET_DAY_COUNTS = [7, 14, 30] as const;

function useTodayString(): DateString {
  const today = formatDate(useToday(undefined, undefined));
  if (!today.isOk) throw new Error(`cannot format today: ${today.error}`);
  return today.value;
}

function lastDays(today: DateString, dayCount: number): DateRangeValue {
  const start = addDays(today, -(dayCount - 1));
  if (!start.isOk) throw new Error(`cannot build a ${dayCount}-day preset: ${start.error}`);
  return { start: start.value, end: today };
}

function RecentPresets({ today }: { readonly today: DateString }) {
  const { draftRange, setRange } = usePickerSelection();
  return PRESET_DAY_COUNTS.map((dayCount) => {
    const preset = lastDays(today, dayCount);
    return (
      <button
        key={dayCount}
        type="button"
        disabled={!validateRange(preset, { max: today, maxDays: MAX_DAYS }).isValid}
        aria-pressed={isSameRange(draftRange, preset)}
        onClick={() => setRange(preset)}
      >
        Last {dayCount} days
      </button>
    );
  });
}

function LengthWarning() {
  const { validity } = usePickerSelection();
  if (!validity.reasons.includes('range-too-long')) return null;
  return <p role="status">Ranges are limited to {MAX_DAYS} days.</p>;
}

function RangeDemo() {
  const today = useTodayString();
  const [range, setRange] = useState<DateRangeValue | null>(() => lastDays(today, 7));
  const [validity, setValidity] = useState<Validity | null>(null);
  return (
    <>
      <DateRangePicker
        aria-label="Report period"
        value={range}
        onValueChange={(next, details) => {
          setRange(next);
          setValidity(details.validity);
        }}
        max={today}
        maxDays={MAX_DAYS}
        limitMode="flag"
        commitMode="confirm"
        numberOfMonths={2}
        presets={<RecentPresets today={today} />}
        footer={<LengthWarning />}
      />
      <output>
        value: {JSON.stringify(range)} · reasons: {JSON.stringify(validity?.reasons ?? [])}
      </output>
    </>
  );
}

export function DateRangePickerDemo() {
  return (
    <DemoProvider>
      <RangeDemo />
    </DemoProvider>
  );
}
