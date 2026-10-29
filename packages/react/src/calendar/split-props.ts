// Goal: Root가 받은 props를 훅 props와 DOM props로 나눔. 훅 prop이 DOM 속성으로 새어 나가지 않게 함
export const splitProps = <Props extends object, Key extends keyof Props>(
  props: Props,
  keys: readonly Key[],
): readonly [Pick<Props, Key>, Omit<Props, Key>] => {
  const keySet: ReadonlySet<PropertyKey> = new Set(keys);
  const entries = Object.entries(props);
  const picked = Object.fromEntries(entries.filter(([key]) => keySet.has(key))) as Pick<Props, Key>; // as: keys에 든 키만 골라 담았으므로 Pick 모양임
  const rest = Object.fromEntries(entries.filter(([key]) => !keySet.has(key))) as Omit<Props, Key>; // as: keys에 든 키를 모두 뺐으므로 Omit 모양임
  return [picked, rest];
};
