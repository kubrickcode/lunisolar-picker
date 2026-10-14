import { type Context, createContext } from 'react';

const UNRESTRICTED: WheelRootState = { isDisabled: false, isInvalid: false, isReadOnly: false };

export type WheelRootState = {
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
  readonly isReadOnly: boolean;
};

// Goal: fieldset처럼 Wheel.Root에 준 disabled·readOnly·invalid가 안의 모든 열에 퍼짐. Root 밖에서 쓴 열은 제한이 없음
export const WheelRootContext: Context<WheelRootState> = createContext<WheelRootState>(UNRESTRICTED);
