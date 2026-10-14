import { type CSSProperties, Fragment, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { DateFieldContext } from '../date-field/date-field-context';
import { Segment, Separator as SegmentSeparator } from '../date-field/parts';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { DateRangeFieldContext, useDateRangeFieldContext } from './date-range-field-context';
import { type RangeSide, type UseDateRangeFieldProps, useDateRangeField } from './use-date-range-field';

export interface RootProps extends UseDateRangeFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, { readonly isInvalid: boolean }> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
}

export interface SeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, Record<string, never>> | undefined;
}

export interface SideProps {
  readonly children?: ReactNode;
  readonly className?: string | undefined;
}

export const Root = (props: RootProps): ReactElement => {
  const field = useDateRangeField(props);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? (
      <>
        <Start />
        <Separator />
        <End />
      </>
    ),
  };
  return (
    <DateRangeFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), { isInvalid: field.isInvalid })}
    </DateRangeFieldContext>
  );
};

export const End = (props: SideProps): ReactElement => <Side side="end" {...props} />;

export const Separator = ({ render, children, ...props }: SeparatorProps): ReactElement => {
  const range = useDateRangeFieldContext();
  const separatorProps = mergeProps(range.getRangeSeparatorProps(), {
    ...props,
    children: children ?? range.start.context.locale.rangeSeparator,
  });
  return renderElement('span', render, separatorProps, {});
};

export const Start = (props: SideProps): ReactElement => <Side side="start" {...props} />;

// Goal: 한쪽 끝을 DateFieldContext로 감싸 DateField.Segment·Separator를 그대로 재사용함
const Side = ({ side, children, className }: SideProps & { readonly side: RangeSide }): ReactElement => {
  const range = useDateRangeFieldContext();
  const core = range[side];
  const { labels } = core.context.locale;
  return (
    <DateFieldContext value={core}>
      <div
        {...mergeProps(core.getRootProps(), {
          className,
          'aria-label': side === 'start' ? labels.rangeStart : labels.rangeEnd,
        })}
      >
        {children ??
          core.state.segments.map((segment, index) => (
            <Fragment key={segment.kind}>
              {index > 0 && <SegmentSeparator />}
              <Segment index={index} />
            </Fragment>
          ))}
        <HiddenInput {...range.getHiddenInputProps(side)} />
      </div>
    </DateFieldContext>
  );
};

export { useDateRangeFieldContext };
