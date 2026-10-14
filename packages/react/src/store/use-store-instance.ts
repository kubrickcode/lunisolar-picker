import { createStore, type Reducer, type Store } from '@lunisolar-picker/core';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

type KeyedStore<State, Event> = {
  readonly resetKey: string | undefined;
  readonly store: Store<State, Event>;
};

export type StoreInstance<State, Event> = {
  // Goal: 이벤트를 보낸 직후 다시 렌더되기 전의 상태를 읽음. 확인 버튼이 commit 뒤 같은 클릭에서 달력을 닫아도 확정 값을 알릴 수 있게 함 (M4 preflight 1.4)
  readonly getSnapshot: () => State;
  readonly send: (event: Event) => void;
  readonly state: State;
};

export type StoreInstanceOptions = {
  // Goal: 생성 시점에 고정되는 상태(로케일별 세그먼트 순서, 24:00 허용 여부의 시 최댓값)가 바뀌면 store를 새로 만듦 (preflight 3.5, 3.9)
  readonly resetKey?: string | undefined;
};

// Constraint: store는 인스턴스마다 한 번만 만들고, 바뀐 prop은 context ref로 읽게 함. 서버 렌더에서 요청끼리 상태가 섞이지 않음 (스펙 3.3)
// Goal: resetKey로 store를 새로 만들 때 이전 상태를 넘겨, 확정 값을 잃지 않고 새 설정으로 다시 만들게 함
export const useStoreInstance = <State, Event, Context>(
  createInitialState: (previous: State | undefined) => State,
  reducer: Reducer<State, Event, Context>,
  context: Context,
  options: StoreInstanceOptions = {},
): StoreInstance<State, Event> => {
  const { resetKey } = options;
  const contextRef = useRef(context);
  useLayoutEffect(() => {
    // 의도적 변경: React ref 객체는 current 대입으로만 갱신됨
    contextRef.current = context;
  });
  const createKeyedStore = (previous: State | undefined): KeyedStore<State, Event> => ({
    resetKey,
    store: createStore({ initialState: createInitialState(previous), reducer, readContext: () => contextRef.current }),
  });
  const [keyedStore, setKeyedStore] = useState(() => createKeyedStore(undefined));
  // Goal: 렌더 중 상태 갱신이라 React가 이 렌더 결과를 버리고 새 store로 곧바로 다시 렌더함. 이펙트로 바꾸면 옛 순서가 한 번 화면에 나옴
  const current = keyedStore.resetKey === resetKey ? keyedStore : createKeyedStore(keyedStore.store.getSnapshot());
  if (current !== keyedStore) setKeyedStore(current);
  const { store } = current;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { getSnapshot: store.getSnapshot, send: store.send, state };
};
