// Goal: undefined를 받을 수 있는 키만 선택 키가 되고, 필수 키는 그대로 필수로 남음
export type CompactShape<Shape extends object> = {
  [Key in keyof Shape as undefined extends Shape[Key] ? never : Key]: Shape[Key];
} & {
  [Key in keyof Shape as undefined extends Shape[Key] ? Key : never]?: Exclude<Shape[Key], undefined>;
};

// Constraint: exactOptionalPropertyTypes 아래에서 undefined 값을 가진 키를 core 옵션 객체에 넘기지 않으려고 제거함
export const compactObject = <Shape extends object>(shape: Shape): CompactShape<Shape> =>
  // as: undefined 값을 가진 키만 빠지므로 남은 키는 undefined가 아닌 원래 값 타입을 가짐
  Object.fromEntries(Object.entries(shape).filter(([, value]) => value !== undefined)) as CompactShape<Shape>;
