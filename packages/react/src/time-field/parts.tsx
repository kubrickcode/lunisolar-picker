import { type CSSProperties, Fragment, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput as HiddenInputElement } from '../value/hidden-input';
import { TimeFieldContext, useTimeFieldContext } from './time-field-context';
import { type TimeFieldApi, type UseTimeFieldProps, useTimeField } from './use-time-field';

const TIME_SEPARATOR = ':';

export interface TimeFieldRenderState {
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
}

export interface RootProps extends UseTimeFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, TimeFieldRenderState> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
}

export interface SegmentProps {
  readonly index: number;
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, { readonly index: number }> | undefined;
  readonly className?: string | undefined;
}

export interface SeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLSpanElement>, Record<string, never>> | undefined;
}

export const Root = (props: RootProps): ReactElement => {
  const field = useTimeField(props);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? <DefaultTimeFieldContents field={field} />,
  };
  return (
    <TimeFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), {
        isInvalid: field.isInvalid,
        isDisabled: field.isDisabled,
      })}
    </TimeFieldContext>
  );
};

export const HiddenInput = (): ReactElement | null => {
  const field = useTimeFieldContext();
  return <HiddenInputElement {...field.getHiddenInputProps()} />;
};

export const Segment = ({ index, render, className }: SegmentProps): ReactElement => {
  const field = useTimeFieldContext();
  return renderElement('span', render, mergeProps(field.segmentedField.getSegmentProps(index), { className }), {
    index,
  });
};

export const Separator = ({ render, children, ...props }: SeparatorProps): ReactElement => {
  const field = useTimeFieldContext();
  return renderElement(
    'span',
    render,
    mergeProps(field.getSeparatorProps(), { ...props, children: children ?? TIME_SEPARATOR }),
    {},
  );
};

const DefaultTimeFieldContents = ({ field }: { readonly field: TimeFieldApi }): ReactElement => (
  <>
    {field.state.segments.map((segment, index) => (
      <Fragment key={segment.kind}>
        {index > 0 && <Separator />}
        <Segment index={index} />
      </Fragment>
    ))}
    <HiddenInputElement {...field.getHiddenInputProps()} />
  </>
);

export { useTimeFieldContext };
