import type { ValidationReason } from '@lunisolar-picker/calendar';

const INCOMPLETE_REASON: ValidationReason = 'incomplete';

export type VisibleInvalidityInput = {
  // Goal: 앱이 invalid prop으로 정한 무효, 또는 부품을 소유한 쪽이 더한 무효(범위 단위 이유 등)
  readonly invalid: boolean;
  readonly reasons: readonly ValidationReason[];
};

// Goal: 입력 중(incomplete)인 것만으로는 무효로 보이지 않게 함. 다른 이유가 하나라도 있으면 입력 중이어도 무효로 보임 (DateField·TimeField·DateRangeField·휠 공통)
export const isVisiblyInvalid = ({ invalid, reasons }: VisibleInvalidityInput): boolean =>
  invalid || reasons.some((reason) => reason !== INCOMPLETE_REASON);
