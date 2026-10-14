export type CompactShape<Shape extends object> = { [Key in keyof Shape]?: Exclude<Shape[Key], undefined> };

// Constraint: exactOptionalPropertyTypes 아래에서 undefined 값을 가진 키를 core 옵션 객체에 넘기지 않으려고 제거함
export const compactObject = <Shape extends object>(shape: Shape): CompactShape<Shape> =>
  // as: undefined 값을 가진 키만 빠지므로 남은 키는 undefined가 아닌 원래 값 타입을 가짐
  Object.fromEntries(Object.entries(shape).filter(([, value]) => value !== undefined)) as CompactShape<Shape>;
