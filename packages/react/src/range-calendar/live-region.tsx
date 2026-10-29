import type { ReactElement } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { VISUALLY_HIDDEN_STYLE } from '../utilities/visually-hidden';

export type LiveRegionProps = {
  readonly message: string;
};

// Goal: 화면을 보지 않아도 범위 선택 진행을 알 수 있게 바뀐 안내만 정중하게 읽게 함 (스펙 10.1)
// Constraint: 테마 없이도 화면에서 숨김. 보이는 안내가 필요한 앱은 announcement를 직접 그림
export const LiveRegion = ({ message }: LiveRegionProps): ReactElement => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    style={VISUALLY_HIDDEN_STYLE}
    {...partAttributes('live-region')}
  >
    {message}
  </div>
);
