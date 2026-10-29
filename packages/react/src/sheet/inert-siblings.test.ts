import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeSiblingsInert } from './inert-siblings';

let page: HTMLElement;
let sheetA: HTMLElement;
let sheetB: HTMLElement;

const createElement = (): HTMLElement => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

beforeEach(() => {
  page = createElement();
  sheetA = createElement();
  sheetB = createElement();
});

afterEach(() => {
  for (const element of [page, sheetA, sheetB]) element.remove();
});

describe('makeSiblingsInert', () => {
  it('keeps siblings inert until the last overlapping sheet closes, whatever the release order', () => {
    const releaseA = makeSiblingsInert(sheetA);
    const releaseB = makeSiblingsInert(sheetB);

    releaseA();
    expect(page.inert).toBe(true);
    expect(page.getAttribute('aria-hidden')).toBe('true');

    releaseB();
    expect(page.inert).toBe(false);
    expect(page.hasAttribute('aria-hidden')).toBe(false);
  });

  it('restores a pre-existing aria-hidden value', () => {
    page.setAttribute('aria-hidden', 'false');

    const release = makeSiblingsInert(sheetA);
    expect(page.getAttribute('aria-hidden')).toBe('true');
    release();

    expect(page.getAttribute('aria-hidden')).toBe('false');
  });

  it('leaves an element that was already inert untouched', () => {
    page.inert = true;

    const release = makeSiblingsInert(sheetA);
    release();

    expect(page.inert).toBe(true);
    expect(page.hasAttribute('aria-hidden')).toBe(false);
  });

  it('ignores a second release of the same call', () => {
    const releaseA = makeSiblingsInert(sheetA);
    const releaseB = makeSiblingsInert(sheetB);

    releaseA();
    releaseA();

    expect(page.inert).toBe(true);
    releaseB();
  });
});
