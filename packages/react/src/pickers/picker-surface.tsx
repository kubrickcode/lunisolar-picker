import { type ReactElement, type ReactNode, type RefObject, useCallback, useEffect, useId } from 'react';
import { partAttributes, stateAttributes } from '../contract/data-attributes';
import { Popover, type ResolvedPresentation, Sheet, usePopoverContext } from '../index';
import type { PickerTriggerProps } from './trigger-render-props';

type PickerSurfaceProps = {
  readonly children: ReactNode;
  readonly isDisabled?: boolean | undefined;
  readonly isOpen: boolean;
  // Goal: 읽기 전용이면 표면을 열지 않지만 트리거는 포커스를 받음. 값을 보이는 트리거·앱 트리거가 입력 자리라 ref.focus()·폼 검증 포커스·탭 이동이 닿아야 함
  readonly isReadOnly?: boolean | undefined;
  readonly label: string;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly presentation: ResolvedPresentation;
  readonly renderTrigger: (triggerProps: PickerTriggerProps) => ReactElement;
  // Goal: picker의 ref.focus()와 폼 검증 포커스가 트리거로 갈 수 있게 트리거 요소를 picker에 알려 줌
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
};

type PopoverTriggerSlotProps = Pick<PickerSurfaceProps, 'isDisabled' | 'isReadOnly' | 'renderTrigger' | 'triggerRef'>;

// Constraint: Content는 닫히면 언마운트되므로 확인 모드에서 확정하지 않고 닫으면 임시 선택이 자연히 버려짐 (M4 Review Focus 5)
export const PickerSurface = ({
  children,
  isDisabled,
  isOpen,
  isReadOnly,
  label,
  onOpenChange,
  presentation,
  renderTrigger,
  triggerRef,
}: PickerSurfaceProps): ReactElement => {
  const sheetId = useId();
  // Constraint: 비활성·읽기 전용 picker는 표면을 보이지 않음. defaultOpen·제어 open으로 열려 있어도, 열린 채 비활성이 되어도 닫힘
  const isBlocked = isDisabled === true || isReadOnly === true;
  const isShown = isOpen && !isBlocked;
  // Goal: 막혀서 닫힌 것을 열림 상태에도 알려 data-open·aria-expanded·앱의 open이 실제 표면과 어긋나지 않게 함
  useEffect(() => {
    if (isOpen && isBlocked) onOpenChange(false);
  }, [isBlocked, isOpen, onOpenChange]);
  if (presentation === 'sheet') {
    // Constraint: Sheet에는 Trigger 부품이 없어 팝오버 트리거와 같은 속성을 직접 만듦
    // Constraint: Sheet는 열기 전 포커스로 돌려주는데, Safari는 클릭한 버튼에 포커스를 주지 않으므로 열기 전에 트리거에 포커스함
    const triggerProps: PickerTriggerProps = {
      ref: triggerRef,
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': isShown,
      'aria-controls': isShown ? sheetId : undefined,
      onClick: () => {
        triggerRef.current?.focus({ preventScroll: true });
        onOpenChange(!isShown);
      },
      ...partAttributes('popover-trigger', { open: isShown }),
      ...blockedTriggerProps({ isDisabled, isReadOnly }),
    };
    return (
      <>
        {renderTrigger(triggerProps)}
        <Sheet.Root open={isShown} onOpenChange={onOpenChange}>
          <Sheet.Content id={sheetId} aria-label={label}>
            {children}
          </Sheet.Content>
        </Sheet.Root>
      </>
    );
  }
  return (
    <Popover.Root open={isShown} onOpenChange={onOpenChange}>
      <PopoverTriggerSlot
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        renderTrigger={renderTrigger}
        triggerRef={triggerRef}
      />
      <Popover.Content aria-label={label}>{children}</Popover.Content>
    </Popover.Root>
  );
};

// Goal: 팝오버의 ref 콜백(위치 기준·포커스 복귀)을 바꾸지 않고 picker의 트리거 ref를 함께 붙임
const PopoverTriggerSlot = ({
  isDisabled,
  isReadOnly,
  renderTrigger,
  triggerRef,
}: PopoverTriggerSlotProps): ReactElement => {
  const { ref: popoverRef, ...popoverTriggerProps } = usePopoverContext().getTriggerProps();
  const ref = useCallback(
    (node: HTMLButtonElement | null) => {
      const releasePopoverRef = popoverRef(node);
      // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
      triggerRef.current = node;
      return () => {
        if (typeof releasePopoverRef === 'function') releasePopoverRef();
        else popoverRef(null);
        triggerRef.current = null;
      };
    },
    [popoverRef, triggerRef],
  );
  return renderTrigger({ ...popoverTriggerProps, ...blockedTriggerProps({ isDisabled, isReadOnly }), ref });
};

// Constraint: 비활성은 네이티브 disabled로 포커스도 막고, 읽기 전용은 입력 칸처럼 포커스는 받되 aria-disabled로 알리고 누름을 무시함
const blockedTriggerProps = ({
  isDisabled,
  isReadOnly,
}: Pick<PickerSurfaceProps, 'isDisabled' | 'isReadOnly'>): PickerTriggerProps => {
  if (isDisabled === true) return { disabled: true };
  if (isReadOnly !== true) return {};
  return { 'aria-disabled': true, onClick: ignoreClick, ...stateAttributes({ readonly: true }) };
};

const ignoreClick = (): void => {};

// Constraint: 시트는 화면 폭이 좁아 여러 달을 세로로 쌓으면 한참 스크롤해야 하므로 한 달만 보임
export const monthCountForSurface = (
  presentation: ResolvedPresentation,
  numberOfMonths: number | undefined,
): number | undefined => (presentation === 'sheet' ? 1 : numberOfMonths);
