import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const DISABLED_VIEW_BUTTON_PATTERN = /\[data-lsp-part="calendar-view-button"\]\[data-disabled\]/;
const LEAF_RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;
const MONO_FILE = '../src/mono.css';
const REDUCED_MOTION_QUERY = '@media (prefers-reduced-motion: reduce)';
const YEARS_VIEW_EXCLUSION = ':not([data-view="years"])';

type CssRule = {
  readonly declarations: string;
  readonly selectors: readonly string[];
};

const readMonoCss = async (): Promise<string> => {
  const source = await readFile(new URL(MONO_FILE, import.meta.url), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
};

const parseLeafRules = (css: string): CssRule[] =>
  Array.from(css.matchAll(LEAF_RULE_PATTERN), (match) => ({
    declarations: match[2] ?? '',
    selectors: (match[1] ?? '').split(',').map((selector) => selector.trim()),
  }));

// Goal: 같은 at-rule 블록이 파일에 여러 번 나오므로 모든 블록의 본문을 모음
const extractAtRuleBodies = (css: string, prelude: string): string[] => {
  const preludeIndex = css.indexOf(prelude);
  if (preludeIndex === -1) return [];
  const bodyStart = css.indexOf('{', preludeIndex) + 1;
  const bodyEnd = findMatchingBrace(css, bodyStart);
  return [css.slice(bodyStart, bodyEnd), ...extractAtRuleBodies(css.slice(bodyEnd), prelude)];
};

const findMatchingBrace = (css: string, bodyStart: number): number => {
  // Intentionally sequential - 여는 중괄호 다음부터 깊이를 세며 짝이 맞는 닫는 위치를 찾음
  let depth = 1;
  for (const [offset, character] of Array.from(css.slice(bodyStart)).entries()) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return bodyStart + offset;
  }
  throw new Error('mono.css has an unclosed block');
};

const isCellRule = (rule: CssRule): boolean =>
  rule.selectors.some((selector) => selector.includes('[data-lsp-part="calendar-cell"]'));

// Constraint: 계약 밖 선택자, layer 밖 규칙, 규칙 없는 부품 검사는 selector-contract.test.ts가 함. 여기서는 달력에만 있는 규칙을 봄
describe('mono.css calendar', () => {
  describe('motion', () => {
    it('stops the month slide when reduced motion is requested', async () => {
      const reducedMotionRules = extractAtRuleBodies(await readMonoCss(), REDUCED_MOTION_QUERY).flatMap(parseLeafRules);

      expect(
        reducedMotionRules.some(
          (rule) =>
            rule.selectors.some((selector) => selector.includes('[data-slide]')) &&
            /animation:\s*none/.test(rule.declarations),
        ),
      ).toBe(true);
    });
  });

  describe('cells', () => {
    it('leaves touch-action alone so touch scrolls the page', async () => {
      const cellRules = parseLeafRules(await readMonoCss()).filter(isCellRule);

      expect(cellRules.filter((rule) => rule.declarations.includes('touch-action'))).toEqual([]);
    });

    it('stops text selection so mouse and pen drags select days', async () => {
      const cellRules = parseLeafRules(await readMonoCss()).filter(isCellRule);

      expect(cellRules.some((rule) => /(^|[;\s])user-select:\s*none/.test(rule.declarations))).toBe(true);
      expect(cellRules.some((rule) => /-webkit-user-select:\s*none/.test(rule.declarations))).toBe(true);
    });
  });

  describe('view button', () => {
    it('does not dim the years-view button, which is the current step', async () => {
      const disabledSelectors = parseLeafRules(await readMonoCss())
        .flatMap((rule) => rule.selectors)
        .filter((selector) => DISABLED_VIEW_BUTTON_PATTERN.test(selector));

      expect(disabledSelectors.length).toBeGreaterThan(0);
      expect(disabledSelectors.filter((selector) => !selector.includes(YEARS_VIEW_EXCLUSION))).toEqual([]);
    });
  });
});
