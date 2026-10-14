import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lockBodyScroll } from './scroll-lock';

const TALL_PAGE_HEIGHT = '4000px';
const SCROLL_POSITION = 1234;

let filler: HTMLDivElement;

beforeEach(() => {
  filler = document.createElement('div');
  filler.style.blockSize = TALL_PAGE_HEIGHT;
  document.body.append(filler);
  window.scrollTo(0, SCROLL_POSITION);
});

afterEach(() => {
  filler.remove();
  window.scrollTo(0, 0);
});

describe('lockBodyScroll', () => {
  it('pins the body at the current scroll position and restores it exactly', () => {
    const release = lockBodyScroll();

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe(`-${SCROLL_POSITION}px`);

    release();

    expect(document.body.style.position).toBe('');
    expect(window.scrollY).toBe(SCROLL_POSITION);
  });

  it('keeps the page locked until every nested lock is released', () => {
    const releaseOuter = lockBodyScroll();
    const releaseInner = lockBodyScroll();

    releaseInner();
    expect(document.body.style.position).toBe('fixed');

    releaseOuter();
    expect(document.body.style.position).toBe('');
  });

  it('ignores a second release of the same lock', () => {
    const releaseOuter = lockBodyScroll();
    const releaseInner = lockBodyScroll();

    releaseInner();
    releaseInner();

    expect(document.body.style.position).toBe('fixed');
    releaseOuter();
  });
});
