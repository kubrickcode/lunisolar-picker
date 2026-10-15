import type { CSSProperties } from 'react';

// Goal: 화면에서는 숨기되 보조 기술은 읽는 표준 sr-only 모양. 테마가 없어도 숨겨지도록 인라인으로 씀
// Constraint: opacity: 0은 넣지 않음. 투명한 요소를 건너뛰는 보조 기술이 있어 live region 안내가 읽히지 않을 수 있음
export const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  blockSize: 1,
  border: 0,
  clipPath: 'inset(50%)',
  inlineSize: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
};
