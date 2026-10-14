// Constraint: exactOptionalPropertyTypes 아래에서 undefined 값을 가진 키를 core 옵션 객체에 넘기지 않으려고 제거함
export const compactObject = <Shape extends object>(shape: Shape): Shape =>
  // as: undefined 값을 가진 선택 키만 빠지므로 원래 모양을 유지함
  Object.fromEntries(Object.entries(shape).filter(([, value]) => value !== undefined)) as Shape;
