import { DatePicker } from '@lunisolar-picker/react/pickers';
import { PeriodFilter } from './period-filter';

// Goal: 서버 컴포넌트가 함수 prop 없이 완성형을 직접 렌더해도 "use client" 경계가 유지되는지 확인함 (Review Focus 1)
export default function FixturePage() {
  return (
    <main>
      <h1>lunisolar-picker next fixture</h1>
      <DatePicker name="installedAt" defaultValue="2026-10-14" />
      <PeriodFilter />
    </main>
  );
}
