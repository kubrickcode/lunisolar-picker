import type { DateRangeValue } from '@lunisolar-picker/calendar';
import type { RangeLimitMode } from '@lunisolar-picker/core';
import {
  Calendar,
  DateRangeField,
  Popover,
  RangeCalendar,
  useRangeCalendarContext,
  type ValueChangeDetails,
} from '@lunisolar-picker/react';
import { useState } from 'react';

export interface MyDateRangePickerProps {
  readonly endName?: string;
  readonly label: string;
  readonly limitMode?: RangeLimitMode;
  readonly max?: string;
  readonly maxDays?: number;
  readonly onValueChange: (value: DateRangeValue | null, details: ValueChangeDetails) => void;
  readonly startName?: string;
  readonly value: DateRangeValue | null;
}

function ConfirmButtons() {
  const calendar = useRangeCalendarContext();
  return (
    <div data-lsp-part="picker-footer">
      <Popover.Close>Cancel</Popover.Close>
      <Popover.Close disabled={!calendar.validity.isValid} onClick={() => calendar.commit()}>
        Apply
      </Popover.Close>
    </div>
  );
}

export function MyDateRangePicker({
  endName,
  label,
  limitMode,
  max,
  maxDays,
  onValueChange,
  startName,
  value,
}: MyDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const constraints = { limitMode, max, maxDays };
  return (
    <div data-lsp-part="date-range-picker">
      <DateRangeField.Root
        aria-label={label}
        value={value}
        onValueChange={onValueChange}
        startName={startName}
        endName={endName}
        {...constraints}
      />
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger aria-label={`${label}: choose in calendar`}>📅</Popover.Trigger>
        <Popover.Content aria-label={label}>
          <RangeCalendar.Root value={value} onValueChange={onValueChange} commitMode="confirm" {...constraints}>
            <Calendar.Layout />
            <ConfirmButtons />
          </RangeCalendar.Root>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
