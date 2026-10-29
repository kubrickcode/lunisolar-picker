import type { CalendarSystem } from '@lunisolar-picker/calendar';
import type { LocaleData } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { LunisolarProvider } from '@lunisolar-picker/react';
import type { ReactNode } from 'react';

interface DemoProviderProps {
  readonly calendars?: readonly CalendarSystem[];
  readonly children: ReactNode;
  readonly locale?: LocaleData;
}

// Constraint: 문서는 빌드한 날과 읽는 날이 달라 '오늘'이 어긋나므로 데모는 client:only로만 렌더하고 브라우저 시간대를 씀
// Constraint: not-content는 Starlight 본문 요소 사이 여백 규칙이 데모 안 picker 부품을 밀어내지 않게 함
export function DemoProvider({ calendars, children, locale = en }: DemoProviderProps) {
  return (
    <LunisolarProvider locale={locale} calendars={calendars}>
      <div className="demo-frame not-content">{children}</div>
    </LunisolarProvider>
  );
}
