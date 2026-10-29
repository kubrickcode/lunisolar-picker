import {
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useImperativeHandle,
} from 'react';
import { DateFieldContext } from '../date-field/date-field-context';
import { LeapMonthToggle, Segment, Separator as SegmentSeparator } from '../date-field/parts';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput } from '../value/hidden-input';
import { DateRangeFieldContext, useDateRangeFieldContext } from './date-range-field-context';
import { type RangeSide, type UseDateRangeFieldProps, useDateRangeField } from './use-date-range-field';

export interface DateRangeFieldRenderState {
  readonly isInvalid: boolean;
  readonly isDisabled: boolean;
}

export interface RootProps extends UseDateRangeFieldProps {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, DateRangeFieldRenderState> | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly id?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly children?: ReactNode;
  // Goal: ref.focus()가 시작일 첫 입력 칸에 포커스함 (스펙 7.6). react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀
  readonly ref?: Ref<{ focus(): void }> | undefined;
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
  useImperativeHandle(props.ref, () => ({ focus: field.focus }), [field.focus]);
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
      {renderElement('div', props.render, mergeProps(field.getRootProps(), appProps), {
        isInvalid: field.isInvalid,
        isDisabled: field.isDisabled,
      })}
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

// Goal: 한쪽 끝을 DateFieldContext로 감싸 DateField.Segment·Separator·LeapMonthToggle을 그대로 재사용함. 기본 내용에 윤달 토글이 있어야 L 키가 없는 모바일에서도 윤달을 입력함
const Side = ({ side, children, className }: SideProps & { readonly side: RangeSide }): ReactElement => {
  const range = useDateRangeFieldContext();
  const core = range[side];
  const { labels } = core.context.locale;
  const sideLabel = side === 'start' ? labels.rangeStart : labels.rangeEnd;
  return (
    <DateFieldContext value={core}>
      <div
        {...mergeProps(core.getRootProps(), {
          className,
          'aria-label': sideLabel,
        })}
      >
        {children ?? (
          <>
            {core.state.segments.map((segment, index) => (
              <Fragment key={segment.kind}>
                {index > 0 && <SegmentSeparator />}
                <Segment index={index} />
              </Fragment>
            ))}
            <LeapMonthToggle aria-label={`${sideLabel} ${labels.leapMonth}`} />
          </>
        )}
        <HiddenInput {...range.getHiddenInputProps(side)} />
      </div>
    </DateFieldContext>
  );
};

export { useDateRangeFieldContext };
