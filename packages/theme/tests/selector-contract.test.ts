import { readFile } from 'node:fs/promises';
import { DATA_ATTRIBUTES, PART_ATTRIBUTE, PART_NAMES, type PartName } from '@lunisolar-picker/react/contract';
import { describe, expect, it } from 'vitest';

const ALLOWED_CLASS_NAMES = ['dark'];
const ALLOWED_EXTRA_ATTRIBUTES = [PART_ATTRIBUTE, 'data-theme'];
const ATTRIBUTE_SELECTOR_PATTERN = /\[(data-[a-z-]+)/g;
const CLASS_SELECTOR_PATTERN = /\.([a-zA-Z_][\w-]*)/g;
const FORBIDDEN_SELECTOR_PATTERN = /\[\s*(aria-[a-z-]+|role)\b/g;
// Constraint: translate·rotate·scale 개별 속성은 Chrome 104부터라 기준선(Chrome 99) 밖임. transform 함수만 씀 (preflight 4.9)
const INDIVIDUAL_TRANSFORM_PROPERTY_PATTERN = /(^|[;{\s])(translate|rotate|scale)\s*:/;
const LAYER_OPENING = '@layer lunisolar-picker {';
const MONO_FILE = '../src/mono.css';
// Constraint: M4가 만들 달력·picker 부품이라 아직 규칙이 없음. M4는 부품에 스타일을 넣을 때 이 목록에서 지움(남겨 두면 아래 테스트가 실패함)
// Constraint: M3 부품은 순수 래퍼까지 모두 규칙이 있어 이 목록에 없음. 규칙이 필요 없는 래퍼 부품을 새로 만들면 이유와 함께 여기에 더함
const PARTS_WITHOUT_RULES: readonly PartName[] = [
  // Constraint: M4-T10이 만들 picker 부품이라 그 작업에서 스타일을 붙임 (preflight 1.1)
  'month-picker',
  'time-picker',
  'wheel-date-picker',
  // Constraint: 부품이 인라인 sr-only 스타일로 숨기므로 테마가 꾸밀 것이 없음 (M4-T4 fix 1)
  'live-region',
];
const PART_SELECTOR_PATTERN = /\[data-lsp-part\s*[~|^$*]?=\s*['"]?([a-z-]+)/g;
const THEME_FILES = [MONO_FILE, '../src/bridge/shadcn.css'];

const readCss = async (file: string): Promise<string> => {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
};

const readThemeSources = async (): Promise<string> => {
  const sources = await Promise.all(THEME_FILES.map(readCss));
  return sources.join('\n');
};

const findFirstBlockEnd = (css: string): number => {
  // Intentionally sequential - 여는 중괄호부터 깊이를 세며 첫 번째 짝이 맞는 닫는 위치를 찾음
  let depth = 0;
  for (const [index, character] of Array.from(css).entries()) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (character === '}' && depth === 0) return index;
  }
  return -1;
};

// Constraint: M4가 같은 이름의 layer 블록을 mono.css 끝에 이어 붙이므로 블록이 여러 개여도 되지만, 블록 밖 규칙은 허용하지 않음
const isOnlyLayerBlocks = (css: string): boolean => {
  const trimmed = css.trim();
  if (!trimmed.startsWith(LAYER_OPENING)) return false;
  const blockEnd = findFirstBlockEnd(trimmed);
  if (blockEnd === -1) return false;
  const rest = trimmed.slice(blockEnd + 1).trim();
  return rest === '' || isOnlyLayerBlocks(rest);
};

describe('theme selector contract', () => {
  it('styles only through the public data attributes', async () => {
    const css = await readThemeSources();
    const usedAttributes = new Set(Array.from(css.matchAll(ATTRIBUTE_SELECTOR_PATTERN), (match) => match[1]));
    const allowed = new Set<string>([...DATA_ATTRIBUTES, ...ALLOWED_EXTRA_ATTRIBUTES]);

    expect([...usedAttributes].filter((attribute) => attribute && !allowed.has(attribute))).toEqual([]);
  });

  it('targets only known part names with any attribute operator', async () => {
    const css = await readThemeSources();
    const usedParts = new Set(Array.from(css.matchAll(PART_SELECTOR_PATTERN), (match) => match[1]));
    const knownParts = new Set<string>(PART_NAMES);

    expect([...usedParts].filter((part) => part && !knownParts.has(part))).toEqual([]);
  });

  it('keeps every theme file non-empty and mono.css full of part selectors', async () => {
    const sources = await Promise.all(THEME_FILES.map(readCss));
    const monoCss = await readCss(MONO_FILE);

    expect(sources.every((css) => css.trim().length > 0)).toBe(true);
    expect(Array.from(monoCss.matchAll(PART_SELECTOR_PATTERN)).length).toBeGreaterThan(0);
  });

  it('gives every part a rule in mono.css except the listed parts M4 has yet to style', async () => {
    const monoCss = await readCss(MONO_FILE);
    const styledParts = new Set(Array.from(monoCss.matchAll(PART_SELECTOR_PATTERN), (match) => match[1]));
    const partsWithoutRules = new Set<string>(PARTS_WITHOUT_RULES);

    expect(PART_NAMES.filter((part) => !partsWithoutRules.has(part) && !styledParts.has(part))).toEqual([]);
    expect(PARTS_WITHOUT_RULES.filter((part) => styledParts.has(part))).toEqual([]);
  });

  it('uses no class, aria or role selectors', async () => {
    const css = await readThemeSources();
    const selectorText = css.replace(/\{[^{}]*\}/g, ';');
    const usedClasses = Array.from(selectorText.matchAll(CLASS_SELECTOR_PATTERN), (match) => match[1]);
    const forbidden = Array.from(css.matchAll(FORBIDDEN_SELECTOR_PATTERN), (match) => match[1]);

    expect(usedClasses.filter((name) => name && !ALLOWED_CLASS_NAMES.includes(name))).toEqual([]);
    expect(forbidden).toEqual([]);
  });

  it('keeps every rule inside lunisolar-picker cascade layer blocks', async () => {
    const sources = await Promise.all(THEME_FILES.map(readCss));

    expect(sources.map(isOnlyLayerBlocks)).toEqual([true, true]);
  });

  it('accepts appended layer blocks but rejects a rule between them', () => {
    const block = `${LAYER_OPENING} [data-lsp-part="wheel"] { color: red; } }`;

    expect(isOnlyLayerBlocks(`${block}\n${block}`)).toBe(true);
    expect(isOnlyLayerBlocks(`${block}\n[data-lsp-part="wheel"] { color: red; }\n${block}`)).toBe(false);
  });

  it('avoids CSS features below the browser baseline', async () => {
    const css = await readThemeSources();

    expect(css).not.toMatch(/\babs\(/);
    expect(css).not.toMatch(/plaintext-only/);
    expect(css).not.toMatch(/color-mix\(/);
    expect(css).not.toMatch(/:has\(/);
    expect(css).not.toMatch(INDIVIDUAL_TRANSFORM_PROPERTY_PATTERN);
  });
});
