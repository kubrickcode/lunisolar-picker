import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';

export type LiveRegionProps = {
  readonly message: string;
};

// Goal: 화면을 보지 않아도 범위 선택 진행을 알 수 있게 바뀐 안내만 정중하게 읽게 함 (스펙 10.1)
export const LiveRegion = ({ message }: LiveRegionProps): ReactElement => (
  <div role="status" aria-live="polite" aria-atomic="true" {...partAttributes('live-region')}>
    {message}
  </div>
);
