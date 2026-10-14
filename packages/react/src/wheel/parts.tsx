import type { ColumnOption } from '@lunisolar-picker/core';
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { mergeProps } from '../utilities/merge-props';
import { type UseWheelProps, useWheel, type WheelApi } from './use-wheel';

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
}

export const Root = ({ children, ...props }: RootProps): ReactElement => (
  <div {...mergeProps({ role: 'group', ...partAttributes('wheel') }, props)}>{children}</div>
);

export const Column = <Value,>({ className, style, renderItem, ...props }: ColumnProps<Value>): ReactElement => {
  const wheel = useWheel(props);
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

export const Highlight = (props: HTMLAttributes<HTMLDivElement>): ReactElement => (
  <div {...mergeProps({ 'aria-hidden': true, ...partAttributes('wheel-highlight') }, props)} />
);

export const Item = ({ wheel, index, children }: ItemProps): ReactElement => {
  const itemProps = wheel.getItemProps(index);
  return <div {...itemProps}>{children ?? itemProps.children}</div>;
};
