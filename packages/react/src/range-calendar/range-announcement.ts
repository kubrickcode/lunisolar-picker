import { type CalendarSystem, type EpochDay, gregory, weekdayOf } from '@lunisolar-picker/calendar';
import {
  displayedRange,
  type LocaleData,
  type RangeSelectionState,
  toWeekday,
  type Validity,
} from '@lunisolar-picker/core';
import { formatOrNull } from '../value/format-or-null';

const MESSAGE_SEPARATOR = ' ';

type DayLabelInput = {
  readonly calendar: CalendarSystem;
  readonly epochDay: EpochDay;
  readonly locale: LocaleData;
};

export type RangeAnnouncementInput = {
  readonly calendar: CalendarSystem;
  readonly locale: LocaleData;
  readonly selection: RangeSelectionState;
  readonly validity: Validity;
};

// Goal: 시작일 선택·범위 완성·무효 이유만 알리고, 호버 미리보기 중에는 조용히 함 (스펙 10.1 live region)
export const describeRangeAnnouncement = ({
  calendar,
  locale,
  selection,
  validity,
}: RangeAnnouncementInput): string => {
  const range = displayedRange(selection);
  if (range === null || selection.preview !== null) return '';
  // Constraint: 시작일 안내는 끝을 고르는 중일 때만. 열린 끝으로 확정된 범위는 알릴 문구가 아직 없어 조용히 함
  if (range.end === null)
    return selection.anchor === null
      ? ''
      : locale.labels.formatRangeStartSelected(dayLabelOf({ calendar, epochDay: range.start, locale }));
  if (!validity.isValid)
    return validity.reasons.map((reason) => locale.labels.validation[reason]).join(MESSAGE_SEPARATOR);
  return locale.labels.formatRangeSummary(
    dayLabelOf({ calendar, epochDay: range.start, locale }),
    dayLabelOf({ calendar, epochDay: range.end, locale }),
    range.end - range.start + 1,
  );
};

// Constraint: 표시 역법이 그 날을 적을 수 없으면 양력 값 문자열로 대신 읽음. 렌더 중이라 던지지 않음
const dayLabelOf = ({ calendar, epochDay, locale }: DayLabelInput): string => {
  const fields = calendar.fromEpochDay(epochDay);
  if (fields.isOk) return locale.formatDayLabel(fields.value, toWeekday(weekdayOf(epochDay)), calendar.id);
  return formatOrNull(epochDay, gregory) ?? String(epochDay);
};
