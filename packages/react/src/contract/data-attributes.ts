// Goal: 부품과 theme이 공유하는 공개 스타일 계약의 단일 정의 (스펙 7.4)
export const DATA_ATTRIBUTES = [
  'data-selected',
  'data-today',
  'data-disabled',
  'data-readonly',
  'data-outside',
  'data-in-range',
  'data-range-start',
  'data-range-end',
  'data-preview',
  'data-invalid',
  'data-focused',
  'data-open',
  'data-placeholder',
  'data-calendar',
  'data-view',
  'data-weekday',
] as const;

export const PART_ATTRIBUTE = 'data-lsp-part';

export const PART_NAMES = [
  'calendar',
  'calendar-header',
  'calendar-heading',
  'calendar-nav-button',
  'calendar-today-button',
  'calendar-toggle',
  'calendar-view-button',
  'calendar-grid',
  'calendar-head-cell',
  'calendar-cell',
  'calendar-month-grid',
  'calendar-year-grid',
  'date-field',
  'date-field-segment',
  'date-field-separator',
  'date-field-leap-toggle',
  'date-range-field',
  'time-field',
  'time-field-segment',
  'time-field-separator',
  'wheel',
  'wheel-column',
  'wheel-track',
  'wheel-item',
  'wheel-highlight',
  'popover',
  'popover-trigger',
  'sheet',
  'sheet-backdrop',
  'picker-footer',
  'picker-presets',
] as const;

export type DataAttribute = (typeof DATA_ATTRIBUTES)[number];

export type PartName = (typeof PART_NAMES)[number];

type StateFlagName = DataAttribute extends `data-${infer Name}` ? Name : never;

export type StateFlags = Partial<Record<StateFlagName, boolean | string | number | null | undefined>>;

export type DataAttributeProps = { readonly 'data-lsp-part'?: PartName } & Partial<Record<DataAttribute, string>>;

export const stateAttributes = (flags: StateFlags): DataAttributeProps => {
  const entries = Object.entries(flags).flatMap(([name, flag]): [string, string][] => {
    if (flag === true) return [[`data-${name}`, '']];
    if (typeof flag === 'string' || typeof flag === 'number') return [[`data-${name}`, String(flag)]];
    return [];
  });
  // as: 키가 StateFlags에서 왔으므로 DataAttribute 이름과 일치함
  return Object.fromEntries(entries) as DataAttributeProps;
};

export const partAttributes = (part: PartName, flags: StateFlags = {}): DataAttributeProps => ({
  [PART_ATTRIBUTE]: part,
  ...stateAttributes(flags),
});
