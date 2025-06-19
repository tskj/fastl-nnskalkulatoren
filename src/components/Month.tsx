import { memo } from 'react';
import {
  CalendarMonth,
  CalendarDate,
  numberOfDaysInMonth,
  dayOfWeek,
  monthNumber
} from 'typescript-calendar-date';
import type { DayStatus } from '@/app/page';

interface MonthProps {
  month: CalendarMonth;
  getDayStatus: (year: number, month: string, day: number) => DayStatus;
  updateDayStatus: (year: number, month: string, day: number, status: DayStatus) => void;
  startDrag: (action: 'add' | 'remove') => void;
  endDrag: () => void;
  handleDragOver: (year: number, month: string, day: number) => void;
  selectionMode: DayStatus;
  dragAction: 'add' | 'remove';
  isHoliday: (date: CalendarDate) => boolean;
}

function Month({ month, getDayStatus, updateDayStatus, startDrag, endDrag, handleDragOver, selectionMode, isHoliday }: MonthProps) {
  // Get month name and year
  const monthNames = [
    'januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember'
  ];
  const monthIndex = monthNumber(month.month) - 1;
  const monthName = monthNames[monthIndex];

  // Handle mouse down on day (start drag and select current day)
  const handleMouseDown = (day: CalendarDate) => {
    const currentStatus = getDayStatus(day.year, day.month, day.day);
    
    // Determine action based on current state
    let action: 'add' | 'remove';
    if (currentStatus === selectionMode) {
      // If clicking on a day with the same status as selection mode, start removing
      updateDayStatus(day.year, day.month, day.day, null);
      action = 'remove';
    } else {
      // Otherwise, start adding
      updateDayStatus(day.year, day.month, day.day, selectionMode);
      action = 'add';
    }
    
    startDrag(action);
  };

  // Handle mouse enter on day (select if dragging)
  const handleMouseEnter = (day: CalendarDate) => {
    handleDragOver(day.year, day.month, day.day);
  };

  // Handle mouse over for more responsive dragging
  const handleMouseOver = (day: CalendarDate) => {
    handleDragOver(day.year, day.month, day.day);
  };

  // Get number of days in this month
  const daysInMonth = numberOfDaysInMonth(month);

  // Create all dates for this month
  const days: CalendarDate[] = Array.from({ length: daysInMonth }, (_, i) => ({
    year: month.year,
    month: month.month,
    day: i + 1
  }));

  // Get the first day to determine starting position
  const firstDayOfWeek = dayOfWeek(days[0]);

  // Convert to array index (Monday = 0)
  const weekDayMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const startPosition = weekDayMap[firstDayOfWeek];

  return (
    <div className="p-4">
      {/* Month header */}
      <div className="text-center mb-4">
        <h3
          className="font-medium text-lg capitalize"
          style={{ color: 'var(--text-primary)' }}
        >
          {monthName}
        </h3>
      </div>

      {/* Calendar grid - always exactly 6 rows (42 cells) */}
      <div className="grid grid-cols-7 calendar-grid">
        {Array.from({ length: 42 }, (_, cellIndex) => {
          const dayIndex = cellIndex - startPosition;
          const isValidDay = dayIndex >= 0 && dayIndex < daysInMonth;
          
          if (!isValidDay) {
            return <div key={`empty-${cellIndex}`} className="calendar-day"></div>;
          }
          
          const day = days[dayIndex];
          const dayWeekDay = dayOfWeek(day);
          const isWeekend = dayWeekDay === 'sat' || dayWeekDay === 'sun';
          const isSunday = dayWeekDay === 'sun';
          const dayStatus = getDayStatus(day.year, day.month, day.day);
          const isNorwegianHoliday = isHoliday(day);

          // Clean approach: use your library to verify grid adjacency
          const currentDayOfWeek = dayOfWeek(day);

          // Simple approach: check if consecutive days are truly adjacent in the calendar grid
          const leftDay = day.day > 1 ? { year: day.year, month: day.month, day: day.day - 1 } : null;
          const rightDay = day.day < daysInMonth ? { year: day.year, month: day.month, day: day.day + 1 } : null;
          
          // For horizontal neighbors, they must be consecutive days AND not cross week boundaries
          const isLeftNeighbor = leftDay && currentDayOfWeek !== 'mon';
          const isRightNeighbor = rightDay && currentDayOfWeek !== 'sun';

          // Check top neighbor (vertically adjacent, same day of week)
          const topDay = day.day - 7 >= 1 ? { year: day.year, month: day.month, day: day.day - 7 } : null;
          const topDayOfWeek = topDay ? dayOfWeek(topDay) : null;
          const isTopNeighbor = topDayOfWeek === currentDayOfWeek;

          // Check bottom neighbor (vertically adjacent, same day of week)
          const bottomDay = day.day + 7 <= daysInMonth ? { year: day.year, month: day.month, day: day.day + 7 } : null;
          const bottomDayOfWeek = bottomDay ? dayOfWeek(bottomDay) : null;
          const isBottomNeighbor = bottomDayOfWeek === currentDayOfWeek;

          const leftStatus = leftDay && isLeftNeighbor ? getDayStatus(leftDay.year, leftDay.month, leftDay.day) : null;
          const rightStatus = rightDay && isRightNeighbor ? getDayStatus(rightDay.year, rightDay.month, rightDay.day) : null;
          const topStatus = topDay && isTopNeighbor ? getDayStatus(topDay.year, topDay.month, topDay.day) : null;
          const bottomStatus = bottomDay && isBottomNeighbor ? getDayStatus(bottomDay.year, bottomDay.month, bottomDay.day) : null;
          
          // Check connections
          const connectLeft = leftStatus === dayStatus && dayStatus !== null;
          const connectRight = rightStatus === dayStatus && dayStatus !== null;
          const connectTop = topStatus === dayStatus && dayStatus !== null;
          const connectBottom = bottomStatus === dayStatus && dayStatus !== null;

          // Get styling based on status
          const getStatusStyle = () => {
            // Holiday styling takes precedence for text color, but user selections still show
            const holidayTextColor = (isNorwegianHoliday || isSunday) ? 'text-red-600 dark:text-red-400 font-medium' : '';
            
            if (!dayStatus) {
              return {
                className: holidayTextColor,
                style: { color: (isNorwegianHoliday || isSunday) ? undefined : 'var(--text-primary)' }
              };
            }

            let bgColor = '';
            let textColor = '';
            switch (dayStatus) {
              case 'ferie':
                bgColor = 'bg-blue-200 dark:bg-blue-800';
                textColor = (isNorwegianHoliday || isSunday) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-blue-900 dark:text-blue-100';
                break;
              case 'permisjon_med_lonn':
                bgColor = 'bg-green-200 dark:bg-green-800';
                textColor = (isNorwegianHoliday || isSunday) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-900 dark:text-green-100';
                break;
              case 'permisjon_uten_lonn':
                bgColor = 'bg-orange-200 dark:bg-orange-800';
                textColor = (isNorwegianHoliday || isSunday) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-orange-900 dark:text-orange-100';
                break;
            }

            // Build rounded corners based on connections - each corner independently
            const corners = [];
            if (!connectTop && !connectLeft) corners.push('rounded-tl-md');
            if (!connectTop && !connectRight) corners.push('rounded-tr-md');
            if (!connectBottom && !connectLeft) corners.push('rounded-bl-md');
            if (!connectBottom && !connectRight) corners.push('rounded-br-md');
            
            // If no connections at all, use full rounding
            const roundedClasses = corners.length === 4 ? 'rounded-md' : corners.join(' ');

            // Add connection classes for overlapping
            const connectionClasses = [];
            if (connectRight) connectionClasses.push('connect-right');
            if (connectBottom) connectionClasses.push('connect-bottom');

            return {
              className: `${bgColor} ${textColor} ${roundedClasses} relative ${connectionClasses.join(' ')}`,
              style: {}
            };
          };

          const statusStyle = getStatusStyle();

          return (
            <div
              key={`${day.year}-${day.month}-${day.day}`}
              data-day-key={`${day.year}-${day.month}-${day.day}`}
              className={`
                calendar-day flex items-center justify-center text-sm
                transition-all duration-200
                ${statusStyle.className}
                ${isWeekend
                  ? 'opacity-50'
                  : isNorwegianHoliday
                    ? 'cursor-default'
                    : dayStatus 
                      ? 'cursor-pointer'
                      : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }
              `}
              style={statusStyle.style}
              onMouseDown={() => !isWeekend && !isNorwegianHoliday && handleMouseDown(day)}
              onMouseEnter={() => !isWeekend && !isNorwegianHoliday && handleMouseEnter(day)}
              onMouseOver={() => !isWeekend && !isNorwegianHoliday && handleMouseOver(day)}
              onMouseUp={endDrag}
            >
              {day.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Month);
