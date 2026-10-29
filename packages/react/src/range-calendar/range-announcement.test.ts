import { gregory } from '@lunisolar-picker/calendar';
import { createRangeSelectionState, type RangeSelectionState, VALID } from '@lunisolar-picker/core';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it } from 'vitest';
import { dayLabel, epochDayAt } from '../testing/korean-fixture';
import { describeRangeAnnouncement } from './range-announcement';

const empty = createRangeSelectionState(null);

const selectingFrom = (isoDate: string): RangeSelectionState => ({
  ...empty,
  anchor: epochDayAt(isoDate),
  draft: { range: { start: epochDayAt(isoDate), end: null }, calendarId: 'gregory' },
});

const completeRange = (startIsoDate: string, endIsoDate: string): RangeSelectionState => ({
  ...empty,
  draft: { range: { start: epochDayAt(startIsoDate), end: epochDayAt(endIsoDate) }, calendarId: 'gregory' },
});

describe('describeRangeAnnouncement', () => {
  it('stays silent with nothing selected', () => {
    expect(describeRangeAnnouncement({ selection: empty, validity: VALID, locale: ko, calendar: gregory })).toBe('');
  });

  it('announces the chosen start while waiting for an end', () => {
    const selecting = selectingFrom('2026-10-13');

    expect(describeRangeAnnouncement({ selection: selecting, validity: VALID, locale: ko, calendar: gregory })).toBe(
      ko.labels.formatRangeStartSelected(dayLabel('2026-10-13')),
    );
  });

  it('stays silent while a hover preview is shown', () => {
    const previewing: RangeSelectionState = { ...selectingFrom('2026-10-13'), preview: epochDayAt('2026-10-15') };

    expect(describeRangeAnnouncement({ selection: previewing, validity: VALID, locale: ko, calendar: gregory })).toBe(
      '',
    );
  });

  it('stays silent for a committed range with an open end', () => {
    const openEnded: RangeSelectionState = {
      ...empty,
      draft: { range: { start: epochDayAt('2026-10-13'), end: null }, calendarId: 'gregory' },
    };

    expect(describeRangeAnnouncement({ selection: openEnded, validity: VALID, locale: ko, calendar: gregory })).toBe(
      '',
    );
  });

  it('summarises a complete range with its inclusive day count', () => {
    const complete = completeRange('2026-10-13', '2026-10-17');

    expect(describeRangeAnnouncement({ selection: complete, validity: VALID, locale: ko, calendar: gregory })).toBe(
      ko.labels.formatRangeSummary(dayLabel('2026-10-13'), dayLabel('2026-10-17'), 5),
    );
  });

  it('reads the validation messages for an invalid range', () => {
    const complete = completeRange('2026-10-01', '2026-10-10');

    expect(
      describeRangeAnnouncement({
        selection: complete,
        validity: { isValid: false, reasons: ['range-too-long'] },
        locale: ko,
        calendar: gregory,
      }),
    ).toBe(ko.labels.validation['range-too-long']);
  });
});
