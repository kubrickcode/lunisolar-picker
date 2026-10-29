import { describe, expect, it, vi } from 'vitest';
import { mergeProps, mergeRefs } from './merge-props';

describe('mergeProps', () => {
  it('joins class names and merges styles with the override winning', () => {
    const merged = mergeProps(
      { className: 'part', style: { color: 'red', margin: 0 } },
      { className: 'app', style: { color: 'blue' } },
    );

    expect(merged).toEqual({ className: 'part app', style: { color: 'blue', margin: 0 } });
  });

  it('runs the app handler first and skips the part handler after preventDefault', () => {
    const partHandler = vi.fn();
    const appHandler = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    const merged = mergeProps({ onClick: partHandler }, { onClick: appHandler });
    const preventDefault = vi.fn();

    // as: 합성 이벤트 전체를 흉내 내지 않고 병합기가 읽는 두 메서드만 채움
    merged.onClick({ preventDefault, isDefaultPrevented: () => preventDefault.mock.calls.length > 0 } as never);

    expect(appHandler).toHaveBeenCalledOnce();
    expect(partHandler).not.toHaveBeenCalled();
  });

  it('runs both handlers when the app handler does not prevent default', () => {
    const partHandler = vi.fn();
    const appHandler = vi.fn();
    const merged = mergeProps({ onKeyDown: partHandler }, { onKeyDown: appHandler });

    // as: 합성 이벤트 전체를 흉내 내지 않고 병합기가 읽는 메서드만 채움
    merged.onKeyDown({ isDefaultPrevented: () => false } as never);

    expect(appHandler).toHaveBeenCalledOnce();
    expect(partHandler).toHaveBeenCalledOnce();
  });

  it('keeps the base value when the override is undefined', () => {
    expect(mergeProps({ id: 'part' }, { id: undefined })).toEqual({ id: 'part' });
  });
});

describe('mergeRefs', () => {
  it('assigns object and callback refs and clears them on cleanup', () => {
    // as: 초기 상태가 null인 ref 객체의 요소 타입을 지정
    const objectRef = { current: null as string | null };
    const callbackRef = vi.fn();
    const cleanup = mergeRefs<string>(objectRef, callbackRef)('node');

    expect(objectRef.current).toBe('node');
    expect(callbackRef).toHaveBeenLastCalledWith('node');

    if (typeof cleanup === 'function') cleanup();

    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });
});
