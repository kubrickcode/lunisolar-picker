import { type ReactElement, type ReactNode, type RefObject, useCallback, useId } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { Popover, type ResolvedPresentation, Sheet, usePopoverContext } from '../index';
import type { PickerTriggerProps } from './trigger-render-props';

type PickerSurfaceProps = {
  readonly children: ReactNode;
  readonly isDisabled?: boolean | undefined;
  readonly isOpen: boolean;
  readonly label: string;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly presentation: ResolvedPresentation;
  readonly renderTrigger: (triggerProps: PickerTriggerProps) => ReactElement;
  // Goal: picker의 ref.focus()와 폼 검증 포커스가 트리거로 갈 수 있게 트리거 요소를 picker에 알려 줌
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
};

type PopoverTriggerSlotProps = Pick<PickerSurfaceProps, 'isDisabled' | 'renderTrigger' | 'triggerRef'>;

// Constraint: Content는 닫히면 언마운트되므로 확인 모드에서 확정하지 않고 닫으면 임시 선택이 자연히 버려짐 (M4 Review Focus 5)
export const PickerSurface = ({
  children,
  isDisabled,
  isOpen,
  label,
  onOpenChange,
  presentation,
  renderTrigger,
  triggerRef,
}: PickerSurfaceProps): ReactElement => {
  const sheetId = useId();
  if (presentation === 'sheet') {
    // Constraint: Sheet에는 Trigger 부품이 없어 팝오버 트리거와 같은 속성을 직접 만듦
    // Constraint: Sheet는 열기 전 포커스로 돌려주는데, Safari는 클릭한 버튼에 포커스를 주지 않으므로 열기 전에 트리거에 포커스함
    const triggerProps: PickerTriggerProps = {
      ref: triggerRef,
      type: 'button',
      disabled: isDisabled,
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? sheetId : undefined,
      onClick: () => {
        triggerRef.current?.focus({ preventScroll: true });
        onOpenChange(!isOpen);
      },
      ...partAttributes('popover-trigger', { open: isOpen }),
    };
    return (
      <>
        {renderTrigger(triggerProps)}
        <Sheet.Root open={isOpen} onOpenChange={onOpenChange}>
          <Sheet.Content id={sheetId} aria-label={label}>
            {children}
          </Sheet.Content>
        </Sheet.Root>
      </>
    );
  }
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTriggerSlot isDisabled={isDisabled} renderTrigger={renderTrigger} triggerRef={triggerRef} />
      <Popover.Content aria-label={label}>{children}</Popover.Content>
    </Popover.Root>
  );
};

// Goal: 팝오버의 ref 콜백(위치 기준·포커스 복귀)을 바꾸지 않고 picker의 트리거 ref를 함께 붙임
const PopoverTriggerSlot = ({ isDisabled, renderTrigger, triggerRef }: PopoverTriggerSlotProps): ReactElement => {
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
  return renderTrigger({ ...popoverTriggerProps, disabled: isDisabled, ref });
};
