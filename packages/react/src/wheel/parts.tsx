import type { ColumnOption } from '@lunisolar-picker/core';
import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
  useMemo,
} from 'react';
import { partAttributes } from '../contract/data-attributes';
import { mergeProps } from '../utilities/merge-props';
import { HiddenInput as HiddenInputElement, type HiddenInputProps } from '../value/hidden-input';
import { type UseWheelProps, useWheel, type WheelApi } from './use-wheel';
import { WheelRootContext } from './wheel-root-context';

export interface ColumnProps<Value> extends UseWheelProps<Value> {
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly renderItem?: ((option: ColumnOption<Value>, isSelected: boolean) => ReactNode) | undefined;
}

export interface ItemProps {
  readonly wheel: WheelApi;
  readonly index: number;
  readonly children?: ReactNode;
}

export interface RootProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  // Goal: 안의 모든 열을 한꺼번에 막음. 열마다 준 disabled·readOnly와 합쳐짐
  readonly disabled?: boolean | undefined;
  // Goal: Root의 data-invalid와 함께 안의 모든 열에 aria-invalid를 달아 보조기술에도 알림
  readonly invalid?: boolean | undefined;
  readonly readOnly?: boolean | undefined;
  readonly ref?: Ref<HTMLDivElement> | undefined;
}

export const Root = ({ children, disabled, invalid, readOnly, ...props }: RootProps): ReactElement => {
  const isDisabled = disabled === true;
  const isReadOnly = readOnly === true;
  const isInvalid = invalid === true;
  const rootState = useMemo(() => ({ isDisabled, isInvalid, isReadOnly }), [isDisabled, isInvalid, isReadOnly]);
  const rootAttributes = partAttributes('wheel', {
    disabled: isDisabled,
    invalid: isInvalid,
    readonly: isReadOnly,
  });
  return (
    <WheelRootContext value={rootState}>
      <div {...mergeProps({ role: 'group', ...rootAttributes }, props)}>{children}</div>
    </WheelRootContext>
  );
};

export const Column = <Value,>({ className, style, renderItem, ...props }: ColumnProps<Value>): ReactElement => {
  const root = useContext(WheelRootContext);
  const wheel = useWheel({
    ...props,
    disabled: props.disabled === true || root.isDisabled,
    invalid: props.invalid === true || root.isInvalid,
    readOnly: props.readOnly === true || root.isReadOnly,
  });
  const { start, end } = wheel.renderedRange;
  const indexes = Array.from({ length: Math.max(end - start + 1, 0) }, (_, offset) => start + offset);
  return (
    <div {...mergeProps(wheel.getColumnProps(), { className, style })}>
      <div {...wheel.getTrackProps()}>
        {indexes.map((index) => {
          const option = props.options[index];
          return (
            <Item key={index} wheel={wheel} index={index}>
              {renderItem && option ? renderItem(option, index === wheel.selectedIndex) : undefined}
            </Item>
          );
        })}
      </div>
    </div>
  );
};

// Goal: 휠로 고른 날을 네이티브 form 제출·required 검증·reset에 연결함. useWheelDate의 getHiddenInputProps()를 그대로 펼침
export const HiddenInput = (props: HiddenInputProps): ReactElement | null => <HiddenInputElement {...props} />;

export const Highlight = (props: HTMLAttributes<HTMLDivElement>): ReactElement => (
  <div {...mergeProps({ 'aria-hidden': true, ...partAttributes('wheel-highlight') }, props)} />
);

export const Item = ({ wheel, index, children }: ItemProps): ReactElement => {
  const itemProps = wheel.getItemProps(index);
  return <div {...itemProps}>{children ?? itemProps.children}</div>;
};
