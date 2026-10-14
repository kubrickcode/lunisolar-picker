import { describe, expect, it } from 'vitest';
import { DATA_ATTRIBUTES, PART_NAMES, partAttributes, stateAttributes } from './data-attributes';

describe('data-attributes', () => {
  it('renders state flags alone for elements that another part already names', () => {
    expect(stateAttributes({ selected: true, disabled: false, today: undefined })).toEqual({ 'data-selected': '' });
  });

  it('marks the part and renders true flags as empty attributes', () => {
    expect(partAttributes('date-field-segment', { focused: true, placeholder: false, invalid: undefined })).toEqual({
      'data-lsp-part': 'date-field-segment',
      'data-focused': '',
    });
  });

  it('renders string and number flags as attribute values', () => {
    expect(partAttributes('calendar-cell', { weekday: 0, calendar: 'dangi' })).toEqual({
      'data-lsp-part': 'calendar-cell',
      'data-weekday': '0',
      'data-calendar': 'dangi',
    });
  });

  it('keeps every attribute and part name unique', () => {
    expect(new Set(DATA_ATTRIBUTES).size).toBe(DATA_ATTRIBUTES.length);
    expect(new Set(PART_NAMES).size).toBe(PART_NAMES.length);
  });
});
