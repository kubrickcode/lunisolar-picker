import { hasLeapMonths } from '@lunisolar-picker/core';
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useImperativeHandle,
} from 'react';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput as HiddenInputElement, type HiddenInputProps } from '../value/hidden-input';
import { DateFieldContext, useDateFieldContext } from './date-field-context';
import { type DateFieldApi, type UseDateFieldProps, useDateField } from './use-date-field';

export interface DateFieldRenderState {
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
}

export interface LeapMonthToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, { readonly isLeapMonth: boolean }> | undefined;
}

export interface RootProps extends UseDateFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, DateFieldRenderState> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
  // Goal: ref.focus()가 첫 입력 칸에 포커스함 (스펙 7.6). react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀
  readonly ref?: Ref<{ focus(): void }> | undefined;
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
  const field = useDateField(props);
  useImperativeHandle(props.ref, () => ({ focus: field.focus }), [field.focus]);
  const appProps = {
    className: props.className,
    style: props.style,
    id: props.id,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
    children: props.children ?? <DefaultDateFieldContents field={field} />,
  };
  return (
    <DateFieldContext value={field}>
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), {
        isInvalid: field.isInvalid,
        isDisabled: field.isDisabled,
      })}
    </DateFieldContext>
  );
};

export const HiddenInput = (props: Partial<HiddenInputProps>): ReactElement | null => {
  // as: Root가 넣은 컨텍스트는 DateFieldApi이고, 범위 필드의 한쪽은 hidden input 없이 DateFieldCore만 넣음
  const field = useDateFieldContext() as Partial<DateFieldApi>;
  if (!field.getHiddenInputProps) return null;
  return <HiddenInputElement {...field.getHiddenInputProps()} {...props} />;
};

// Goal: 윤달이 있는 역법으로 입력할 때만 보임. 그해 해당 달에 윤달이 없으면 비활성이지만, 윤달 표시가 켜져 있는 동안은 끌 수 있게 활성으로 둠 (스펙 2.1, 계약 §2.7 ⑧)
export const LeapMonthToggle = ({ render, children, ...props }: LeapMonthToggleProps): ReactElement | null => {
  const field = useDateFieldContext();
  if (!hasLeapMonths(field.entryCalendar)) return null;
  const toggleProps = mergeProps(field.getLeapMonthToggleProps(), {
    ...props,
    children: children ?? field.context.locale.labels.leapMonth,
  });
  return renderElement('button', render, toggleProps, { isLeapMonth: field.state.isLeapMonth });
};

export const Segment = ({ index, render, className }: SegmentProps): ReactElement => {
  const field = useDateFieldContext();
  return renderElement('span', render, mergeProps(field.segmentedField.getSegmentProps(index), { className }), {
    index,
  });
};

export const Separator = ({ render, children, ...props }: SeparatorProps): ReactElement => {
  const field = useDateFieldContext();
  return renderElement(
    'span',
    render,
    mergeProps(field.getSeparatorProps(), { ...props, children: children ?? field.separator }),
    {},
  );
};

const DefaultDateFieldContents = ({ field }: { readonly field: DateFieldApi }): ReactElement => (
  <>
    {field.state.segments.map((segment, index) => (
      <Fragment key={segment.kind}>
        {index > 0 && <Separator />}
        <Segment index={index} />
      </Fragment>
    ))}
    <LeapMonthToggle />
    <HiddenInputElement {...field.getHiddenInputProps()} />
  </>
);

export { useDateFieldContext };
