import { describe, expect, it } from 'vitest';
import { renderDangiTableModule } from './render-dangi-table';

describe('renderDangiTableModule', () => {
  it('writes one encoded year per line labelled with its lunar year', () => {
    const source = renderDangiTableModule({ firstYear: 1900, lastEpochDay: 29_635, encodedYears: [111, 222] });

    expect(source).toContain('export const DANGI_FIRST_YEAR: number = 1900;');
    expect(source).toContain('export const DANGI_LAST_EPOCH_DAY: EpochDay = 29635 as EpochDay;');
    expect(source).toContain('  111, // 1900\n  222, // 1901\n');
    expect(source.startsWith('// 생성 파일')).toBe(true);
  });
});
