import type { FocusEvent } from 'react';

// Goal: 포커스가 부품 그룹 안에서 칸끼리 옮겨 다닐 때는 조용하고, 그룹 밖으로 나갈 때만 한 번 알림. react-hook-form의 touched 판정에 씀
export const createFocusLeaveListener =
  (onFocusLeave: (() => void) | undefined): ((event: FocusEvent<HTMLElement>) => void) =>
  (event) => {
    if (!onFocusLeave) return;
    const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!event.currentTarget.contains(nextFocus)) onFocusLeave();
  };
