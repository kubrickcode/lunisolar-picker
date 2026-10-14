import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import { focusInitialElement, trapTabKey } from '../focus/focusable-elements';
import { useControllableState } from '../utilities/use-controllable-state';
import { makeSiblingsInert } from './inert-siblings';
import { lockBodyScroll } from './scroll-lock';

export interface SheetApi {
  readonly isOpen: boolean;
  setOpen(open: boolean): void;
  getBackdropProps(): SheetBackdropProps;
  getPanelProps(): SheetPanelProps;
}

export type SheetBackdropProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement> };

export type SheetPanelProps = HTMLAttributes<HTMLDivElement> &
  DataAttributeProps & { readonly ref: RefCallback<HTMLDivElement> };

export interface UseSheetProps {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

export const useSheet = ({ open, defaultOpen = false, onOpenChange }: UseSheetProps): SheetApi => {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  // Constraint: 포털이 hydration 뒤에 붙으므로 backdrop 마운트 시점에 effect가 다시 돌도록 state로 보관함
  const [backdropElement, setBackdropElement] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !backdropElement) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScroll = lockBodyScroll();
    const releaseInert = makeSiblingsInert(backdropElement);
    // Intentionally deferred - 포털 콘텐츠가 붙은 뒤에 포커스를 옮겨야 스크롤이 튀지 않음
    const frame = requestAnimationFrame(() => {
      if (panelRef.current) focusInitialElement(panelRef.current);
    });
    return () => {
      cancelAnimationFrame(frame);
      releaseInert();
      releaseScroll();
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen, backdropElement]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Goal: 포커스가 아직 안 옮겨졌거나 body에 있어도 Esc로 닫히게 함. 자식이 Esc를 이미 처리했거나 IME 조합 중이면(Esc는 조합을 먼저 취소함) 닫지 않음
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, close]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current) trapTabKey(event, panelRef.current);
  };

  return {
    isOpen,
    setOpen,
    getBackdropProps: () => ({
      ref: setBackdropElement,
      onClick: onBackdropClick,
      ...partAttributes('sheet-backdrop', { open: isOpen }),
    }),
    getPanelProps: () => ({
      ref: (node) => {
        panelRef.current = node;
      },
      role: 'dialog',
      'aria-modal': true,
      tabIndex: -1,
      onKeyDown: onPanelKeyDown,
      ...partAttributes('sheet', { open: isOpen }),
    }),
  };
};
