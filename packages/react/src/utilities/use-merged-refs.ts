import { type Ref, type RefCallback, useMemo } from 'react';
import { mergeRefs } from './merge-props';

export const useMergedRefs = <Element>(...refs: readonly (Ref<Element> | undefined)[]): RefCallback<Element> =>
  // biome-ignore lint/correctness/useExhaustiveDependencies: 전달된 ref 목록 자체가 의존성
  useMemo(() => mergeRefs(...refs), refs);
