'use client';

import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import type { ReactNode } from 'react';

// Constraint: LocaleData에는 함수가 있어 서버 컴포넌트 props로 넘길 수 없음. 로케일은 클라이언트 경계 안에서 import함
export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today="2026-10-14">
      {children}
    </LunisolarProvider>
  );
}
