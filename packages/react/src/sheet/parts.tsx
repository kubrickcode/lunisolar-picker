import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mergeProps } from '../utilities/merge-props';
import { usePortalContainer } from '../utilities/portal-container';
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

// Constraint: 시트에는 트리거 부품이 없어, 그릴 위치(모달 dialog 안인지)를 알려면 제자리 앵커가 필요함. <template>은 레이아웃에 영향이 없고 표·목록 안에서도 유효함
export const Content = ({ render, children, ...props }: ContentProps): ReactElement | null => {
  const sheet = useSheetContext();
  const isClient = useIsClient();
  const { anchorRef, container } = usePortalContainer();
  if (!sheet.isOpen || !isClient) return null;
  const panel = renderElement('div', render, mergeProps(sheet.getPanelProps(), { ...props, children }), {
    isOpen: true,
  });
  return (
    <>
      <template ref={anchorRef} />
      {container && createPortal(<div {...sheet.getBackdropProps()}>{panel}</div>, container)}
    </>
  );
};

export { useSheetContext };
