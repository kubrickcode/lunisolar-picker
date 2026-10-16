import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const CALENDAR_PART_PATTERN = /\[data-lsp-part="calendar[a-z-]*"\]/;
const DIMMING_DECLARATION_PATTERN = /(^|[;\s])(opacity|filter)\s*:/;
const DISABLED_CALENDAR_SCOPE = '[data-lsp-part="calendar"][data-disabled] ';
const FORCED_COLORS_QUERY = '@media (forced-colors: active)';
const INVALID_ENDPOINT_PARTS = [
  '[data-lsp-part="calendar"][data-invalid]',
  '[data-lsp-part="calendar-cell"][data-selected]',
];
const LEAF_RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;
const MONO_FILE = '../src/mono.css';
const PART_PATTERN = /\[data-lsp-part="[a-z-]+"\]/;
const REDUCED_MOTION_QUERY = '@media (prefers-reduced-motion: reduce)';
const SELECTED_ITEM_SELECTORS = [
  '[data-lsp-part="calendar-cell"][data-selected]',
  '[data-lsp-part="calendar-toggle"] > button[data-selected]',
  '[data-lsp-part="calendar-month-grid"] [data-selected]',
  '[data-lsp-part="calendar-year-grid"] [data-selected]',
];
const VIEW_BUTTON_PART = '[data-lsp-part="calendar-view-button"]';
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
    selectors: splitSelectorList(match[1] ?? ''),
  }));

// Constraint: :not(a, b) 안의 쉼표는 선택자 목록을 나누지 않으므로 괄호 밖 쉼표에서만 나눔
const splitSelectorList = (selectorList: string): string[] =>
  selectorList
    .split(/,(?![^()]*\))/)
    .map((selector) => selector.replace(/\s+/g, ' ').trim())
    .filter((selector) => selector !== '');

// Goal: 같은 at-rule 블록이 파일에 여러 번 나오므로 모든 블록의 본문을 모음
const extractAtRuleBodies = (css: string, prelude: string): string[] => {
  const preludeIndex = css.indexOf(prelude);
  if (preludeIndex === -1) return [];
  const bodyStart = css.indexOf('{', preludeIndex) + 1;
  const bodyEnd = findMatchingBrace(css, bodyStart);
  return [css.slice(bodyStart, bodyEnd), ...extractAtRuleBodies(css.slice(bodyEnd), prelude)];
};

const findMatchingBrace = (css: string, bodyStart: number): number => {
  // Constraint: 깊이는 앞 글자까지 센 값에 이어 세야 하므로 let으로 누적함
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

// Goal: 부품 이름 없는 규칙(button 등)이나 달력 부품을 거치는 규칙은 날짜 칸 버튼에 닿을 수 있음
const canReachCalendar = (selector: string): boolean =>
  !PART_PATTERN.test(selector) || CALENDAR_PART_PATTERN.test(selector);

const readForcedColorRules = async (): Promise<CssRule[]> =>
  extractAtRuleBodies(await readMonoCss(), FORCED_COLORS_QUERY).flatMap(parseLeafRules);

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
    it('leaves touch-action alone on every rule that can reach a day so touch scrolls the page', async () => {
      const touchActionSelectors = parseLeafRules(await readMonoCss())
        .filter((rule) => rule.declarations.includes('touch-action'))
        .flatMap((rule) => rule.selectors);

      expect(touchActionSelectors.filter(canReachCalendar)).toEqual([]);
    });

    it('stops text selection so mouse and pen drags select days', async () => {
      const cellRules = parseLeafRules(await readMonoCss()).filter(isCellRule);

      expect(cellRules.some((rule) => /(^|[;\s])user-select:\s*none/.test(rule.declarations))).toBe(true);
      expect(cellRules.some((rule) => /-webkit-user-select:\s*none/.test(rule.declarations))).toBe(true);
    });
  });

  describe('view button', () => {
    // Constraint: 비활성 달력 안의 보기 버튼은 연 보기여도 흐리게 함. 그 밖의 흐림 규칙은 모두 연 보기를 빼야 함
    it('does not dim the years-view button, which is the current step', async () => {
      const dimmingSelectors = parseLeafRules(await readMonoCss())
        .filter((rule) => DIMMING_DECLARATION_PATTERN.test(rule.declarations))
        .flatMap((rule) => rule.selectors)
        .filter((selector) => selector.includes(VIEW_BUTTON_PART) && !selector.startsWith(DISABLED_CALENDAR_SCOPE));

      expect(dimmingSelectors.length).toBeGreaterThan(0);
      expect(dimmingSelectors.filter((selector) => !selector.includes(YEARS_VIEW_EXCLUSION))).toEqual([]);
    });
  });

  describe('forced colors', () => {
    it('turns off the text backplate on every selected item', async () => {
      const unadjustedSelectors = (await readForcedColorRules())
        .filter((rule) => /forced-color-adjust:\s*none/.test(rule.declarations))
        .flatMap((rule) => rule.selectors);

      expect(
        SELECTED_ITEM_SELECTORS.filter((item) => !unadjustedSelectors.some((selector) => selector.includes(item))),
      ).toEqual([]);
      expect(
        unadjustedSelectors.some(
          (selector) => selector.includes(SELECTED_ITEM_SELECTORS[0] ?? '') && selector.endsWith(' *'),
        ),
      ).toBe(true);
    });

    it('repaints the invalid range endpoints with system colors', async () => {
      const invalidEndpointRules = (await readForcedColorRules()).filter((rule) =>
        rule.selectors.some((selector) => INVALID_ENDPOINT_PARTS.every((part) => selector.includes(part))),
      );

      expect(invalidEndpointRules.some((rule) => /background:\s*Highlight/.test(rule.declarations))).toBe(true);
    });
  });
});
