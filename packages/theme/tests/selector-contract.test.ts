import { readFile } from 'node:fs/promises';
import { DATA_ATTRIBUTES, PART_ATTRIBUTE, PART_NAMES } from '@lunisolar-picker/react/contract';
import { describe, expect, it } from 'vitest';

const ALLOWED_EXTRA_ATTRIBUTES = [PART_ATTRIBUTE, 'data-theme'];
const ATTRIBUTE_SELECTOR_PATTERN = /\[(data-[a-z-]+)/g;
const PART_SELECTOR_PATTERN = /\[data-lsp-part=['"]?([a-z-]+)/g;
const THEME_FILES = ['../src/mono.css', '../src/bridge/shadcn.css'];

const readThemeSources = async (): Promise<string> => {
  const sources = await Promise.all(THEME_FILES.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  return sources.join('\n');
};

describe('theme selector contract', () => {
  it('styles only through the public data attributes', async () => {
    const css = await readThemeSources();
    const usedAttributes = new Set(Array.from(css.matchAll(ATTRIBUTE_SELECTOR_PATTERN), (match) => match[1]));
    const allowed = new Set<string>([...DATA_ATTRIBUTES, ...ALLOWED_EXTRA_ATTRIBUTES]);

    expect([...usedAttributes].filter((attribute) => attribute && !allowed.has(attribute))).toEqual([]);
  });

  it('targets only known part names', async () => {
    const css = await readThemeSources();
    const usedParts = new Set(Array.from(css.matchAll(PART_SELECTOR_PATTERN), (match) => match[1]));
    const knownParts = new Set<string>(PART_NAMES);

    expect([...usedParts].filter((part) => part && !knownParts.has(part))).toEqual([]);
  });

  it('wraps every rule in the lunisolar-picker cascade layer', async () => {
    const css = await readFile(new URL('../src/mono.css', import.meta.url), 'utf8');
    const outsideLayer = css
      .replace(/@layer lunisolar-picker\s*\{[\s\S]*\}\s*$/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    expect(outsideLayer).toBe('');
  });

  it('avoids CSS features below the browser baseline', async () => {
    const css = await readThemeSources();

    expect(css).not.toMatch(/\babs\(/);
    expect(css).not.toMatch(/plaintext-only/);
  });
});
