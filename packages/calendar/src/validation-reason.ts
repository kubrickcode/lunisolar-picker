export const VALIDATION_REASONS = [
  'invalid-date',
  'invalid-time',
  'incomplete',
  'before-min',
  'after-max',
  'disabled-date',
  'outside-calendar-range',
  'range-too-short',
  'range-too-long',
  'range-includes-disabled',
] as const;

export type ValidationReason = (typeof VALIDATION_REASONS)[number];
