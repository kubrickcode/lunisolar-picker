// Goal: 앱이 dir 속성이나 CSS로 정한 실제 쓰기 방향을 읽음. 화살표 키와 드래그 가장자리 방향이 오른쪽에서 왼쪽 문서에서 뒤집힘
export const isRightToLeft = (element: Element): boolean => getComputedStyle(element).direction === 'rtl';
