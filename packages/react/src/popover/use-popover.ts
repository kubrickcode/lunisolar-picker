import { autoUpdate, flip, offset, type Placement, shift, useFloating } from '@floating-ui/react-dom';
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { focusInitialElement, trapTabKey } from '../focus/focusable-elements';
import { useControllableState } from '../utilities/use-controllable-state';
import { useMergedRefs } from '../utilities/use-merged-refs';

const POPOVER_OFFSET_PIXELS = 8;
const VIEWPORT_PADDING_PIXELS = 8;

export interface PopoverApi {
  readonly isOpen: boolean;
  readonly contentId: string;
  setOpen(open: boolean): void;
  closeAndRestoreFocus(): void;
  getTriggerProps(): PopoverTriggerProps;
  getContentProps(): PopoverContentProps;
}

export type PopoverContentProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement>; readonly style: CSSProperties };

export type PopoverTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLButtonElement> };

export interface UsePopoverProps {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly placement?: Placement | undefined;
}

export const usePopover = ({
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
}: UsePopoverProps): PopoverApi => {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement,
    strategy: 'fixed',
    middleware: [
      offset(POPOVER_OFFSET_PIXELS),
      flip({ padding: VIEWPORT_PADDING_PIXELS }),
      shift({ padding: VIEWPORT_PADDING_PIXELS }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const triggerRefCallback = useMergedRefs<HTMLButtonElement>(triggerRef, refs.setReference);
  const contentRefCallback = useMergedRefs<HTMLDivElement>(contentRef, refs.setFloating);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Intentionally deferred - 포털 콘텐츠가 붙고 위치가 잡힌 뒤에 포커스를 옮겨야 스크롤이 튀지 않음
    const frame = requestAnimationFrame(() => {
      if (contentRef.current) focusInitialElement(contentRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      // as: 포인터 이벤트의 target은 DOM 노드임
      const target = event.target as Node | null;
      const isInside = contentRef.current?.contains(target) || triggerRef.current?.contains(target);
      if (!isInside) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Goal: 포커스가 아직 안 옮겨졌거나 body에 있어도 Esc로 닫히게 함. 자식이 Esc를 이미 처리했으면 닫지 않음
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeAndRestoreFocus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, closeAndRestoreFocus]);

  const onContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (contentRef.current) trapTabKey(event, contentRef.current);
  };

  return {
    isOpen,
    contentId,
    setOpen,
    closeAndRestoreFocus,
    getTriggerProps: () => ({
      ref: triggerRefCallback,
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? contentId : undefined,
      onClick: () => setOpen(!isOpen),
      ...partAttributes('popover-trigger', { open: isOpen }),
    }),
    getContentProps: () => ({
      ref: contentRefCallback,
      id: contentId,
      role: 'dialog',
      tabIndex: -1,
      style: floatingStyles,
      onKeyDown: onContentKeyDown,
      ...partAttributes('popover', { open: isOpen }),
    }),
  };
};
