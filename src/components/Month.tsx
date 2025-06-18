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
  startDrag: () => void;
  endDrag: () => void;
  handleDragOver: (year: number, month: string, day: number) => void;
  selectionMode: DayStatus;
}

export default function Month({ month, getDayStatus, updateDayStatus, startDrag, endDrag, handleDragOver, selectionMode }: MonthProps) {
  // Get month name and year
  const monthNames = [
    'januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember'
  ];
  const monthIndex = monthNumber(month.month) - 1;
  const monthName = monthNames[monthIndex];

  // Handle mouse down on day (start drag and select current day)
  const handleMouseDown = (day: CalendarDate) => {
    startDrag();
    updateDayStatus(day.year, day.month, day.day, selectionMode);
  };

  // Handle mouse enter on day (select if dragging)
  const handleMouseEnter = (day: CalendarDate) => {
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startPosition }, (_, i) => (
          <div key={`empty-${i}`} className="aspect-square"></div>
        ))}

        {/* Days of the month */}
        {days.map((day) => {
          const dayWeekDay = dayOfWeek(day);
          const isWeekend = dayWeekDay === 'sat' || dayWeekDay === 'sun';
          const dayStatus = getDayStatus(day.year, day.month, day.day);

          // Get background color based on status
          const getStatusColor = () => {
            switch (dayStatus) {
              case 'ferie':
                return 'bg-blue-200 dark:bg-blue-800';
              case 'permisjon_med_lonn':
                return 'bg-green-200 dark:bg-green-800';
              case 'permisjon_uten_lonn':
                return 'bg-orange-200 dark:bg-orange-800';
              default:
                return '';
            }
          };

          return (
            <div
              key={`${day.year}-${day.month}-${day.day}`}
              className={`
                aspect-square flex items-center justify-center text-sm rounded-md
                transition-colors duration-200
                ${getStatusColor()}
                ${isWeekend
                  ? 'opacity-50'
                  : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }
              `}
              style={{
                color: 'var(--text-primary)'
              }}
              onMouseDown={() => !isWeekend && handleMouseDown(day)}
              onMouseEnter={() => !isWeekend && handleMouseEnter(day)}
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
