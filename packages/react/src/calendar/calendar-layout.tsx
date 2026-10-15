import type { ReactElement, ReactNode } from 'react';
import { partAttributes } from '../contract/data-attributes';
import { useCalendarView } from './calendar-context';
import {
  CalendarCell,
  CalendarGrid,
  CalendarHeader,
  CalendarHeading,
  CalendarNextButton,
  CalendarPrevButton,
  CalendarTodayButton,
} from './calendar-parts';
import { CalendarMonthGrid, CalendarToggle, CalendarViewButton, CalendarYearGrid } from './calendar-view-parts';
import type { CellRenderInfo } from './cell-state';

export interface CalendarLayoutProps {
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
}

// Goal: 완성형과 Root 기본 화면이 같은 배치를 쓰고, 앱은 이 소스를 복사해 고쳐 쓸 수 있음 (스펙 7.5)
export const CalendarLayout = ({ renderCell }: CalendarLayoutProps): ReactElement => {
  const api = useCalendarView();
  return (
    <>
      <CalendarHeader>
        <CalendarPrevButton />
        <CalendarViewButton />
        <CalendarNextButton />
        <CalendarToggle />
        <CalendarTodayButton />
      </CalendarHeader>
      {/* Constraint: 월·연 보기에서는 날짜 격자가 없으므로 둘째 달부터의 제목도 숨김 */}
      {api.navigation.view === 'days' ? (
        <div {...partAttributes('calendar-months')}>
          {api.months.map((month, monthIndex) => (
            <div key={`${month.month.year}-${month.month.monthCode}`} {...partAttributes('calendar-month')}>
              {monthIndex > 0 ? <CalendarHeading monthIndex={monthIndex} /> : null}
              <CalendarGrid monthIndex={monthIndex}>
                {renderCell
                  ? (cell) => (
                      <CalendarCell key={cell.epochDay} cell={cell}>
                        {renderCell}
                      </CalendarCell>
                    )
                  : undefined}
              </CalendarGrid>
            </div>
          ))}
        </div>
      ) : null}
      <CalendarMonthGrid />
      <CalendarYearGrid />
    </>
  );
};
