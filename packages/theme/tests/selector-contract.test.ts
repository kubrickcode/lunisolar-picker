import { readFile } from 'node:fs/promises';
import { DATA_ATTRIBUTES, PART_ATTRIBUTE, PART_NAMES } from '@lunisolar-picker/react/contract';
import { describe, expect, it } from 'vitest';

const ALLOWED_EXTRA_ATTRIBUTES = [PART_ATTRIBUTE, 'data-theme'];
const ALLOWED_CLASS_NAMES = ['dark'];
const ATTRIBUTE_SELECTOR_PATTERN = /\[(data-[a-z-]+)/g;
const CLASS_SELECTOR_PATTERN = /\.([a-zA-Z_][\w-]*)/g;
const FORBIDDEN_SELECTOR_PATTERN = /\[\s*(aria-[a-z-]+|role)\b/g;
const LAYER_OPENING = '@layer lunisolar-picker {';
const MONO_FILE = '../src/mono.css';
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

const isSingleLayerBlock = (css: string): boolean => {
  const trimmed = css.trim();
  if (!trimmed.startsWith(LAYER_OPENING)) return false;
  // Intentionally sequential - 여는 중괄호부터 깊이를 세며 첫 번째 짝이 맞는 위치를 찾음
  let depth = 0;
  for (const [index, character] of Array.from(trimmed).entries()) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (character === '}' && depth === 0) return index === trimmed.length - 1;
  }
  return false;
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

  it('uses no class, aria or role selectors', async () => {
    const css = await readThemeSources();
    const selectorText = css.replace(/\{[^{}]*\}/g, ';');
    const usedClasses = Array.from(selectorText.matchAll(CLASS_SELECTOR_PATTERN), (match) => match[1]);
    const forbidden = Array.from(css.matchAll(FORBIDDEN_SELECTOR_PATTERN), (match) => match[1]);

    expect(usedClasses.filter((name) => name && !ALLOWED_CLASS_NAMES.includes(name))).toEqual([]);
    expect(forbidden).toEqual([]);
  });

  it('wraps every rule in exactly one lunisolar-picker cascade layer', async () => {
    const sources = await Promise.all(THEME_FILES.map(readCss));

    expect(sources.map(isSingleLayerBlock)).toEqual([true, true]);
  });

  it('avoids CSS features below the browser baseline', async () => {
    const css = await readThemeSources();

    expect(css).not.toMatch(/\babs\(/);
    expect(css).not.toMatch(/plaintext-only/);
  });
});
