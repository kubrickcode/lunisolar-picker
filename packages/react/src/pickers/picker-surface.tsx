import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { Popover, type Presentation, Sheet, usePresentation } from '../index';

export interface PickerSurfaceProps {
  readonly children: ReactNode;
  readonly isDisabled?: boolean | undefined;
  readonly isOpen: boolean;
  readonly label: string;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly presentation: Presentation;
  readonly renderTrigger: (triggerProps: ButtonHTMLAttributes<HTMLButtonElement>) => ReactElement;
}

// Constraint: Content는 닫히면 언마운트되므로 확인 모드에서 확정하지 않고 닫으면 임시 선택이 자연히 버려짐 (M4 Review Focus 5)
export const PickerSurface = ({
  children,
  isDisabled,
  isOpen,
  label,
  onOpenChange,
  presentation,
  renderTrigger,
}: PickerSurfaceProps): ReactElement => {
  const resolved = usePresentation(presentation);
  if (resolved === 'sheet') {
    // Constraint: Sheet에는 Trigger 부품이 없어 팝오버 트리거와 같은 속성을 직접 만듦. 닫힐 때 포커스는 Sheet가 열기 전 요소(이 트리거)로 돌려줌
    const triggerProps: ButtonHTMLAttributes<HTMLButtonElement> = {
      type: 'button',
      disabled: isDisabled,
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen,
      onClick: () => onOpenChange(!isOpen),
      ...partAttributes('popover-trigger', { open: isOpen }),
    };
    return (
      <>
        {renderTrigger(triggerProps)}
        <Sheet.Root open={isOpen} onOpenChange={onOpenChange}>
          <Sheet.Content aria-label={label}>{children}</Sheet.Content>
        </Sheet.Root>
      </>
    );
  }
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger disabled={isDisabled} render={renderTrigger} />
      <Popover.Content aria-label={label}>{children}</Popover.Content>
    </Popover.Root>
  );
};
