import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useIsClient } from '../utilities/use-is-client';
import { PopoverContext, usePopoverContext } from './popover-context';
import { type UsePopoverProps, usePopover } from './use-popover';

export interface CloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, PopoverState> | undefined;
}

export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, PopoverState> | undefined;
}

export type PopoverState = {
  readonly isOpen: boolean;
};

export interface RootProps extends UsePopoverProps {
  readonly children: ReactNode;
}

export interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, PopoverState> | undefined;
}

export const Root = ({ children, ...props }: RootProps): ReactElement => {
  const popover = usePopover(props);
  return <PopoverContext value={popover}>{children}</PopoverContext>;
};

export const Close = ({ render, ...props }: CloseProps): ReactElement => {
  const popover = usePopoverContext();
  const closeProps = { type: 'button' as const, onClick: popover.closeAndRestoreFocus };
  return renderElement('button', render, mergeProps(closeProps, props), { isOpen: popover.isOpen });
};

// Constraint: 닫히면 DOM에서 제거함 (M4 부품이 열릴 때마다 새로 마운트된다고 가정)
export const Content = ({ render, ...props }: ContentProps): ReactElement | null => {
  const popover = usePopoverContext();
  const isClient = useIsClient();
  if (!popover.isOpen || !isClient) return null;
  return createPortal(
    renderElement('div', render, mergeProps(popover.getContentProps(), props), { isOpen: popover.isOpen }),
    document.body,
  );
};

export const Trigger = ({ render, ...props }: TriggerProps): ReactElement => {
  const popover = usePopoverContext();
  return renderElement('button', render, mergeProps(popover.getTriggerProps(), props), { isOpen: popover.isOpen });
};

export { usePopoverContext };
