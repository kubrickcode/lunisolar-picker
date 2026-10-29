import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { useIsClient } from '../utilities/use-is-client';
import { SheetContext, useSheetContext } from './sheet-context';
import { type UseSheetProps, useSheet } from './use-sheet';

export interface CloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly render?: RenderProp<ButtonHTMLAttributes<HTMLButtonElement>, SheetState> | undefined;
}

export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, SheetState> | undefined;
}

export interface RootProps extends UseSheetProps {
  readonly children: ReactNode;
}

export type SheetState = {
  readonly isOpen: boolean;
};

export const Root = ({ children, ...props }: RootProps): ReactElement => {
  const sheet = useSheet(props);
  return <SheetContext value={sheet}>{children}</SheetContext>;
};

export const Close = ({ render, ...props }: CloseProps): ReactElement => {
  const sheet = useSheetContext();
  const closeProps = { type: 'button' as const, onClick: () => sheet.setOpen(false) };
  return renderElement('button', render, mergeProps(closeProps, props), { isOpen: sheet.isOpen });
};

export const Content = ({ render, children, ...props }: ContentProps): ReactElement | null => {
  const sheet = useSheetContext();
  const isClient = useIsClient();
  if (!sheet.isOpen || !isClient) return null;
  const panel = renderElement('div', render, mergeProps(sheet.getPanelProps(), { ...props, children }), {
    isOpen: true,
  });
  return createPortal(<div {...sheet.getBackdropProps()}>{panel}</div>, document.body);
};

export { useSheetContext };
