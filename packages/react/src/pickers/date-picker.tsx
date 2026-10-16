import type { DateString } from '@lunisolar-picker/calendar';
import type { LocaleLabels } from '@lunisolar-picker/core';
import type { ReactElement, ReactNode, Ref } from 'react';
import { partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateField,
  type Presentation,
  type UseCalendarProps,
  useControllableState,
  usePickerSettings,
  useSingleCalendar,
  type ValueChangeDetails,
} from '../index';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { TriggerRenderProps } from './trigger-render-props';

export interface DatePickerProps extends UseCalendarProps, PickerOpenProps {
  readonly className?: string | undefined;
  readonly footer?: ReactNode;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  // Goal: ref.focus()가 입력 칸의 첫 칸에 포커스함. react-hook-form이 검증 실패 칸으로 포커스를 옮길 때 씀 (스펙 7.6, preflight 3.7)
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
  readonly separator?: string | undefined;
}

export interface PickerOpenProps {
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((isOpen: boolean) => void) | undefined;
  readonly open?: boolean | undefined;
}

type SingleConfirmFooterProps = {
  readonly labels: Pick<LocaleLabels, 'cancel' | 'confirm'>;
  readonly onClose: () => void;
};

export const DatePicker = (props: DatePickerProps): ReactElement => {
  // Constraint: 폼 참여(name·form·required)와 onBlur·onInvalidValue·ref는 입력 칸만 받음. 포털 안 달력이 같은 이름의 숨은 입력을 또 그리거나 같은 오류를 두 번 알리지 않게 함 (preflight 1.6, 계약 §3.5)
  const {
    className,
    commitMode,
    defaultDisplayCalendar,
    defaultOpen,
    defaultValue,
    displayCalendar,
    footer,
    form,
    getCellLabel,
    name,
    numberOfMonths,
    onBlur,
    onDisplayCalendarChange,
    onInvalidValue,
    onOpenChange,
    onPick,
    onValueChange,
    open,
    placeholder = '',
    presentation = 'auto',
    ref,
    renderCell,
    renderTrigger,
    required,
    separator,
    value,
    ...sharedProps
  } = props;
  const settings = usePickerSettings(props);
  const [currentValue, setCurrentValue] = useControllableState<string | null>(value, defaultValue ?? null, undefined);
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen ?? false, onOpenChange);
  const isConfirmMode = commitMode === 'confirm';
  const { labels } = settings.locale;

  const changeValue = (next: DateString | null, details: ValueChangeDetails): void => {
    setCurrentValue(next);
    onValueChange?.(next, details);
  };

  // Goal: 이미 고른 날을 다시 골라도 닫힘. onValueChange는 값이 바뀔 때만 오므로 고르기 신호로 닫음 (계약 §3.4 onPick)
  const closeOnPick = (picked: DateString): void => {
    onPick?.(picked);
    if (!isConfirmMode) setOpen(false);
  };

  const displayValue = formatDisplayDate(currentValue, settings, separator);
  return (
    <div
      className={className}
      {...partAttributes('date-picker', { open: isOpen, invalid: sharedProps.invalid === true })}
    >
      {renderTrigger ? null : (
        <DateField.Root
          {...sharedProps}
          ref={ref}
          name={name}
          form={form}
          required={required}
          onBlur={onBlur}
          onInvalidValue={onInvalidValue}
          separator={separator}
          value={currentValue}
          onValueChange={changeValue}
        />
      )}
      <PickerSurface
        presentation={presentation}
        isOpen={isOpen}
        isDisabled={sharedProps.disabled === true || sharedProps.readOnly === true}
        onOpenChange={setOpen}
        label={labels.chooseDate}
        renderTrigger={(triggerProps) =>
          renderTrigger ? (
            renderTrigger({ displayValue, isOpen, placeholder, triggerProps })
          ) : (
            <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDate} icon={<CalendarIcon />} />
          )
        }
      >
        <Calendar.Root
          {...sharedProps}
          commitMode={commitMode}
          defaultDisplayCalendar={defaultDisplayCalendar}
          displayCalendar={displayCalendar}
          getCellLabel={getCellLabel}
          numberOfMonths={numberOfMonths}
          onDisplayCalendarChange={onDisplayCalendarChange}
          value={currentValue}
          onValueChange={changeValue}
          onPick={closeOnPick}
        >
          <Calendar.Layout renderCell={renderCell} />
          {footer}
          {isConfirmMode ? <SingleConfirmFooter labels={labels} onClose={() => setOpen(false)} /> : null}
        </Calendar.Root>
      </PickerSurface>
    </div>
  );
};

// Constraint: commit()은 호출 시점에 onValueChange를 부르므로 같은 클릭에서 닫혀 달력이 언마운트돼도 확정 값이 전달됨 (preflight 1.4)
const SingleConfirmFooter = ({ labels, onClose }: SingleConfirmFooterProps): ReactElement => {
  const calendar = useSingleCalendar();
  return (
    <PickerFooter
      labels={labels}
      isConfirmDisabled={calendar.selection.draft === null}
      onCancel={onClose}
      onConfirm={() => {
        calendar.commit();
        onClose();
      }}
    />
  );
};
