import type { Ref, RefCallback } from 'react';

const EVENT_HANDLER_PATTERN = /^on[A-Z]/;

type EventHandler = (event: EventLike) => void;
type EventLike = { readonly isDefaultPrevented?: () => boolean; readonly defaultPrevented?: boolean } | undefined;
type PropsRecord = Record<string, unknown>;

export const mergeProps = <Base extends object, Override extends object>(
  base: Base,
  override: Override,
): Base & Override => {
  // as: 키 단위 병합을 위해 두 객체를 문자열 키 레코드로 다룸
  const baseRecord = base as PropsRecord;
  const mergedEntries = Object.entries(override).map(([key, overrideValue]): [string, unknown] => [
    key,
    mergeProp(key, baseRecord[key], overrideValue),
  ]);
  // as: 병합 결과는 두 타입의 교차 모양을 따름
  return { ...base, ...Object.fromEntries(mergedEntries) } as Base & Override;
};

export const mergeRefs =
  <Element>(...refs: readonly (Ref<Element> | undefined)[]): RefCallback<Element> =>
  (node) => {
    const cleanups = refs.map((ref) => assignRef(ref, node));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };

const mergeProp = (key: string, baseValue: unknown, overrideValue: unknown): unknown => {
  if (overrideValue === undefined) return baseValue;
  if (baseValue === undefined) return overrideValue;
  if (key === 'className') return `${String(baseValue)} ${String(overrideValue)}`;
  // as: style 값은 객체일 때만 병합하며 그 밖은 아래에서 덮어씀
  if (key === 'style') return { ...(baseValue as object), ...(overrideValue as object) };
  // as: ref 키의 값은 Ref 타입임
  if (key === 'ref') return mergeRefs(baseValue as Ref<unknown>, overrideValue as Ref<unknown>);
  const isHandlerPair =
    EVENT_HANDLER_PATTERN.test(key) && typeof baseValue === 'function' && typeof overrideValue === 'function';
  // as: 위에서 함수임을 확인한 이벤트 핸들러 쌍
  if (isHandlerPair) return chainEventHandlers(baseValue as EventHandler, overrideValue as EventHandler);
  return overrideValue;
};

// Goal: 앱이 넘긴 핸들러가 먼저 돌고, 거기서 preventDefault 하면 부품의 기본 동작을 건너뜀
const chainEventHandlers =
  (partHandler: EventHandler, appHandler: EventHandler): EventHandler =>
  (event) => {
    appHandler(event);
    const isPrevented = event?.isDefaultPrevented?.() ?? event?.defaultPrevented ?? false;
    if (!isPrevented) partHandler(event);
  };

const assignRef = <Element>(ref: Ref<Element> | undefined, node: Element | null): (() => void) => {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }
  if (ref) {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
};
