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
  const isDaysView = api.navigation.view === 'days';
  const renderGrid = (monthIndex: number): ReactElement => (
    <CalendarGrid monthIndex={monthIndex}>
      {renderCell
        ? (cell) => (
            <CalendarCell key={cell.epochDay} cell={cell}>
              {renderCell}
            </CalendarCell>
          )
        : undefined}
    </CalendarGrid>
  );
  return (
    <>
      <CalendarToggle />
      {/* Goal: 머리줄을 첫 달 열에 넣어 둘째 달부터의 제목과 같은 줄에 두고, 폭은 날짜 격자에 맞춤 */}
      {/* Constraint: 보기·달이 바뀌어도 머리줄이 같은 자리에 남아야 보기 버튼·이동 버튼의 포커스가 유지되므로 열의 key는 순서로 둠 */}
      <div {...partAttributes('calendar-months')}>
        <div {...partAttributes('calendar-month')}>
          <CalendarHeader>
            <CalendarViewButton />
            <CalendarTodayButton />
            <CalendarPrevButton />
            <CalendarNextButton />
          </CalendarHeader>
          {renderGrid(0)}
          <CalendarMonthGrid />
          <CalendarYearGrid />
        </div>
        {/* Constraint: 월·연 보기에서는 날짜 격자가 없으므로 둘째 달부터의 열도 숨김 */}
        {isDaysView
          ? api.months.slice(1).map((_month, offset) => {
              const monthIndex = offset + 1;
              return (
                <div key={monthIndex} {...partAttributes('calendar-month')}>
                  <CalendarHeading monthIndex={monthIndex} />
                  {renderGrid(monthIndex)}
                </div>
              );
            })
          : null}
      </div>
    </>
  );
};
