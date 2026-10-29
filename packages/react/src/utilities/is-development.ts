declare const process: { readonly env: { readonly NODE_ENV?: string } };

// Constraint: 소비자 번들러가 process.env.NODE_ENV 표현식을 통째로 치환함. 치환되지 않아 process가 없는 환경은 ReferenceError가 나므로 개발 경고를 끔
export const isDevelopment = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
};
