import { cloneElement, createElement, type ElementType, isValidElement, type ReactElement } from 'react';
import { mergeProps } from './merge-props';

export type RenderProp<Props, State> = ReactElement | ((props: Props, state: State) => ReactElement);

// Goal: 앱이 부품의 DOM 요소를 자기 컴포넌트로 바꾸되 부품의 속성·이벤트·ref는 유지하게 함 (스펙 7.3 render prop)
export const renderElement = <Props extends object, State>(
  tagName: ElementType,
  render: RenderProp<Props, State> | undefined,
  props: Props,
  state: State,
): ReactElement => {
  if (typeof render === 'function') return render(props, state);
  if (isValidElement(render)) {
    // as: 요소의 props는 cloneElement가 받는 레코드 모양임
    return cloneElement(render, mergeProps(props, render.props as object) as Record<string, unknown>);
  }
  return createElement(tagName, props);
};
