import type { ValidationReason } from '@lunisolar-picker/calendar';
import { useEffect, useRef } from 'react';

type InvalidValueReportInput = {
  readonly calendarKey: string;
  // Goal: 해석하지 못한 값을 onInvalidValue에 넘길 문자열. 비었거나 해석했으면 null
  readonly input: string | null;
  readonly isEnabled: boolean;
  readonly onInvalidValue: ((input: string, reason: ValidationReason) => void) | undefined;
  readonly reason: ValidationReason | null;
};

// Goal: 입력 칸이 없는 앱 트리거에서도 해석할 수 없는 값을 입력 칸과 같은 규칙으로 값마다 한 번 알림. 달력을 열 때마다 다시 알리지 않음
export const useInvalidValueReport = ({
  calendarKey,
  input,
  isEnabled,
  onInvalidValue,
  reason,
}: InvalidValueReportInput): void => {
  const reportedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEnabled || input === null || reason === null) {
      // 의도적 변경: 다시 같은 잘못된 값이 오면 새로 알리도록 기록을 지움
      reportedKeyRef.current = null;
      return;
    }
    const key = `${calendarKey}|${input}`;
    if (reportedKeyRef.current === key) return;
    // 의도적 변경: 같은 값을 다시 알리지 않도록 렌더와 무관한 기록을 남김
    reportedKeyRef.current = key;
    onInvalidValue?.(input, reason);
  }, [calendarKey, input, isEnabled, onInvalidValue, reason]);
};
