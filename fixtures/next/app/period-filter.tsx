'use client';

import { addDays, type DateRangeValue, isSameRange, parseDate } from '@lunisolar-picker/calendar';
import { validateRange } from '@lunisolar-picker/core';
import { DateRangePicker, usePickerSelection } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';

const TODAY = '2026-10-14';
const MAX_DAYS = 60;
const PRESET_DAY_COUNTS = [7, 30, 60] as const;

function lastDays(dayCount: number): DateRangeValue {
  const today = parseDate(TODAY);
  if (!today.isOk) throw new Error(`invalid fixture date: ${today.error}`);
  const start = addDays(today.value.value, -(dayCount - 1));
  if (!start.isOk) throw new Error(`cannot build preset of ${dayCount} days: ${start.error}`);
  return { start: start.value, end: today.value.value };
}

function RecentPresets() {
  const { draftRange, setRange } = usePickerSelection();
  return (
    <div>
      {PRESET_DAY_COUNTS.map((dayCount) => {
        const preset = lastDays(dayCount);
        const isAllowed = validateRange(preset, { max: TODAY, maxDays: MAX_DAYS }).isValid;
        return (
          <button
            key={dayCount}
            type="button"
            disabled={!isAllowed}
            aria-pressed={isSameRange(draftRange, preset)}
            onClick={() => setRange(preset)}
          >
            최근 {dayCount}일
          </button>
        );
      })}
    </div>
  );
}

export function PeriodFilter() {
  const [period, setPeriod] = useState<DateRangeValue | null>(lastDays(7));
  return (
    <DateRangePicker
      value={period}
      onValueChange={(next) => setPeriod(next)}
      startName="periodStart"
      endName="periodEnd"
      max={TODAY}
      maxDays={MAX_DAYS}
      limitMode="flag"
      commitMode="confirm"
      presets={<RecentPresets />}
    />
  );
}
