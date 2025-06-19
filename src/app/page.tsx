'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CalendarMonth, monthName, CalendarDate, addDays, dayOfWeek, datesEqual } from 'typescript-calendar-date';
import Month from '@/components/Month';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type DayStatus = 'ferie' | 'permisjon_med_lonn' | 'permisjon_uten_lonn' | null;

// Calculate Easter Sunday for a given year using the anonymous Gregorian algorithm
function calculateEaster(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  
  return { year, month: monthName(n), day: p + 1 };
}

// Get all Norwegian public holidays for a given year
function getNorwegianHolidays(year: number): CalendarDate[] {
  const easter = calculateEaster(year);
  
  const holidays: CalendarDate[] = [
    // Fixed holidays
    { year, month: monthName(1), day: 1 },   // New Year's Day
    { year, month: monthName(5), day: 1 },   // Labor Day
    { year, month: monthName(5), day: 17 },  // Constitution Day
    { year, month: monthName(12), day: 25 }, // Christmas Day
    { year, month: monthName(12), day: 26 }, // Boxing Day
    
    // Easter-based holidays
    addDays(easter, -3), // Maundy Thursday (Skjærtorsdag)
    addDays(easter, -2), // Good Friday (Langfredag)
    addDays(easter, 1),  // Easter Monday (2. påskedag)
    addDays(easter, 39), // Ascension Day (Kristi himmelfartsdag)
    addDays(easter, 50), // Whit Monday (2. pinsedag)
  ];
  
  return holidays;
}

// Check if a date is a Norwegian public holiday (including Sundays)
function isNorwegianHoliday(date: CalendarDate, holidays: CalendarDate[]): boolean {
  // Sunday is always a public holiday
  if (dayOfWeek(date) === 'sun') return true;
  
  // Check if date matches any of the specific holidays
  return holidays.some(holiday => datesEqual(date, holiday));
}

export default function Home() {
  const [year, setYear] = useLocalStorage<number>('selectedYear', () => new Date().getFullYear());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [yearlyIncomeDisplay, setYearlyIncomeDisplay] = useLocalStorage<string>('yearlyIncome', '');
  const [vacationPay, setVacationPay] = useLocalStorage<number | null>('vacationPay', null);
  const [vacationPayDisplay, setVacationPayDisplay] = useLocalStorage<string>('vacationPayDisplay', '');
  const [hoursPerDay, setHoursPerDay] = useLocalStorage<number | null>('hoursPerDay', null);
  const [hoursPerDayDisplay, setHoursPerDayDisplay] = useLocalStorage<string>('hoursPerDayDisplay', '');

  // Track hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use current year for server rendering to avoid hydration mismatch
  const displayYear = isHydrated ? year : new Date().getFullYear();

  // Use null for server rendering to avoid hydration mismatch with number inputs
  const displayVacationPay = isHydrated ? vacationPay : null;
  const displayVacationPayText = isHydrated ? vacationPayDisplay : '';
  const displayHoursPerDay = isHydrated ? hoursPerDay : null;
  const displayHoursPerDayText = isHydrated ? hoursPerDayDisplay : '';


  // Ref for dropdown click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track selected days: key is "year-month-day", value is the status
  const [dayStatesObj, setDayStatesObj] = useLocalStorage<Record<string, DayStatus>>('dayStates', {}, displayYear);
  const [isCalendarReady, setIsCalendarReady] = useState(false);

  // Convert to Map for easier usage
  const dayStates = useMemo(() => new Map(Object.entries(dayStatesObj)), [dayStatesObj]);
  const setDayStates = useCallback((updateFn: (prev: Map<string, DayStatus>) => Map<string, DayStatus>) => {
    setDayStatesObj((prevObj: any) => {
      const prevMap = new Map(Object.entries(prevObj));
      const newMap = updateFn(prevMap);
      const newObj = Object.fromEntries(newMap.entries());
      return newObj;
    });
  }, [setDayStatesObj]);

  // Calendar fade in/out animation with proper sequencing
  const [calendarKey, setCalendarKey] = useState(displayYear);
  
  useEffect(() => {
    if (displayYear !== calendarKey) {
      // Fade out first
      setIsCalendarReady(false);
      
      // Wait for fade-out to complete, then switch content and fade in
      const timer = setTimeout(() => {
        setCalendarKey(displayYear);
        // Small delay to ensure content is rendered before fade-in
        setTimeout(() => setIsCalendarReady(true), 16);
      }, 300); // Match CSS transition duration
      
      return () => clearTimeout(timer);
    } else if (isHydrated && !isCalendarReady) {
      // Initial render after hydration
      const timer = setTimeout(() => setIsCalendarReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [displayYear, calendarKey, isCalendarReady, isHydrated]);

  // Current selection mode for drag operations
  const [selectionMode, setSelectionMode] = useState<DayStatus>('ferie');
  
  // High-performance drag state with mathematical intersection detection
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragAction, setDragAction] = useState<'add' | 'remove'>('add');
  const draggedDaysRef = useRef<Set<string>>(new Set());
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);
  const dragStartInfoRef = useRef<{monthIndex: number, dayBox: {row: number, col: number}, relativePos: {x: number, y: number}} | null>(null);
  const touchedDaysSetRef = useRef<Set<string>>(new Set());
  const touchedDaysCountRef = useRef<number>(0);
  const [calculationMethod, setCalculationMethod] = useLocalStorage<'standard' | 'generous' | 'stingy' | 'anal'>('calculationMethod', 'standard');

  // Helper to create day key
  const getDayKey = (year: number, month: string, day: number): string => {
    return `${year}-${month}-${day}`;
  };

  // Update day status
  const updateDayStatus = (year: number, month: string, day: number, status: DayStatus) => {
    const key = `${year}-${month}-${day}`;
    
    setDayStates(prev => {
      const currentStatus = prev.get(key) || null;
      
      // Only update if the status is actually changing
      if (currentStatus !== status) {
        const newMap = new Map(prev);
        if (status === null) {
          newMap.delete(key);
        } else {
          newMap.set(key, status);
        }
        return newMap;
      }
      return prev;
    });
  };

  // Get day status
  const getDayStatus = (year: number, month: string, day: number): DayStatus => {
    const key = getDayKey(year, month, day);
    return dayStates.get(key) || null;
  };


  // Mathematical helper functions for line intersection
  
  
  const getLineIntersectedCells = (x1: number, y1: number, x2: number, y2: number, monthIndex: number) => {
    const monthElement = document.querySelector(`[data-month-index="${monthIndex}"]`);
    if (!monthElement) return [];
    
    const calendarGrid = monthElement.querySelector('.calendar-grid');
    if (!calendarGrid) return [];
    
    const gridRect = calendarGrid.getBoundingClientRect();
    const cellWidth = gridRect.width / 7;
    const cellHeight = gridRect.height / 6;
    
    // Convert to grid coordinates
    const gx1 = (x1 - gridRect.left) / cellWidth;
    const gy1 = (y1 - gridRect.top) / cellHeight;
    const gx2 = (x2 - gridRect.left) / cellWidth;
    const gy2 = (y2 - gridRect.top) / cellHeight;
    
    const intersectedCells = new Set<number>();
    
    // Bresenham-like algorithm for grid traversal
    const dx = Math.abs(gx2 - gx1);
    const dy = Math.abs(gy2 - gy1);
    const stepX = gx1 < gx2 ? 1 : -1;
    const stepY = gy1 < gy2 ? 1 : -1;
    
    let x = Math.floor(gx1);
    let y = Math.floor(gy1);
    const endX = Math.floor(gx2);
    const endY = Math.floor(gy2);
    
    let error = dx - dy;
    
    while (true) {
      // Add current cell if within bounds
      if (x >= 0 && x < 7 && y >= 0 && y < 6) {
        intersectedCells.add(y * 7 + x);
      }
      
      if (x === endX && y === endY) break;
      
      const error2 = error * 2;
      if (error2 > -dy) {
        error -= dy;
        x += stepX;
      }
      if (error2 < dx) {
        error += dx;
        y += stepY;
      }
    }
    
    return Array.from(intersectedCells);
  };
  
  
  
  // Simple drag over handler (legacy fallback)
  const handleDayInteraction = (year: number, month: string, day: number, monthIndex?: number) => {
    // Check if it's a holiday or weekend - don't process those
    const date: CalendarDate = { year, month, day };
    if (isHolidayChecker(date) || dayOfWeek(date) === 'sat' || dayOfWeek(date) === 'sun') {
      return;
    }

    const dayKey = getDayKey(year, month, day);
    
    if (isDragging) {
      // During drag, only process if not already done
      if (touchedDaysSetRef.current.has(dayKey)) return;
      touchedDaysSetRef.current.add(dayKey);
      
      if (dragAction === 'add') {
        updateDayStatus(year, month, day, selectionMode);
      } else {
        updateDayStatus(year, month, day, null);
      }
    } else {
      // Click to toggle
      const currentStatus = getDayStatus(year, month, day);
      if (currentStatus === selectionMode) {
        updateDayStatus(year, month, day, null);
        setDragAction('remove');
      } else {
        updateDayStatus(year, month, day, selectionMode);
        setDragAction('add');
      }
      
      // Start drag with high-performance tracking
      if (typeof monthIndex === 'number') {
        const monthElement = document.querySelector(`[data-month-index="${monthIndex}"]`);
        if (monthElement) {
          const calendarGrid = monthElement.querySelector('.calendar-grid');
          if (calendarGrid) {
            const gridRect = calendarGrid.getBoundingClientRect();
            const cellWidth = gridRect.width / 7;
            const cellHeight = gridRect.height / 6;
            
            // Find which cell this day corresponds to
            const firstDayOfWeek = dayOfWeek({ year, month, day: 1 });
            const weekDayMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
            const startPosition = weekDayMap[firstDayOfWeek];
            const cellIndex = startPosition + (day - 1);
            const row = Math.floor(cellIndex / 7);
            const col = cellIndex % 7;
            
            dragStartInfoRef.current = {
              monthIndex,
              dayBox: { row, col },
              relativePos: { x: cellWidth / 2, y: cellHeight / 2 }
            };
          }
        }
      }
      
      setIsDragging(true);
      touchedDaysSetRef.current = new Set([dayKey]);
      touchedDaysCountRef.current = 1;
      draggedDaysRef.current = new Set([dayKey]);
      
      // Set initial mouse position for line intersection calculation
      lastMousePosRef.current = { x: 0, y: 0 };
      
      // Add the global mouse move listener
      document.addEventListener('mousemove', handleCalendarMouseMove, { passive: true });
    }
  };

  // Get selection mode display text
  const getSelectionModeText = () => {
    switch (selectionMode) {
      case 'ferie':
        return 'ferie';
      case 'permisjon_med_lonn':
        return 'betalt permisjon';
      case 'permisjon_uten_lonn':
        return 'fri uten lønn';
      default:
        return 'ferie';
    }
  };

  // Get selection mode color
  const getSelectionModeColor = () => {
    switch (selectionMode) {
      case 'ferie':
        return 'text-blue-600 dark:text-blue-400';
      case 'permisjon_med_lonn':
        return 'text-green-600 dark:text-green-400';
      case 'permisjon_uten_lonn':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  // Cycle through selection modes
  const cycleSelectionMode = () => {
    switch (selectionMode) {
      case 'ferie':
        setSelectionMode('permisjon_med_lonn');
        break;
      case 'permisjon_med_lonn':
        setSelectionMode('permisjon_uten_lonn');
        break;
      case 'permisjon_uten_lonn':
        setSelectionMode('ferie');
        break;
      default:
        setSelectionMode('ferie');
    }
  };

  // Memoize Norwegian holidays calculation (expensive)
  const holidays = useMemo(() => getNorwegianHolidays(calendarKey), [calendarKey]);
  
  // Memoize holiday checker function
  const isHolidayChecker = useCallback((date: CalendarDate) => isNorwegianHoliday(date, holidays), [holidays]);
  
  
  // Generate all 12 months for the selected year (memoized to avoid recalculation)
  const months: CalendarMonth[] = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      year: calendarKey,
      month: monthName(i + 1)
    })), [calendarKey]);

  const getDayFromCellIndex = (cellIndex: number, monthIndex: number) => {
    // Calculate month info directly instead of using months array to avoid dependency
    const monthNum = monthIndex + 1;
    const year = calendarKey;
    const month = monthName(monthNum);
    
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const firstDayOfWeek = dayOfWeek({ year, month, day: 1 });
    const weekDayMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const startPosition = weekDayMap[firstDayOfWeek];
    
    const dayIndex = cellIndex - startPosition;
    if (dayIndex >= 0 && dayIndex < daysInMonth) {
      return {
        year,
        month,
        day: dayIndex + 1
      };
    }
    return null;
  };

  const processTouchedDays = (cellIndices: number[], monthIndex: number) => {
    let hasNewDays = false;
    
    cellIndices.forEach(cellIndex => {
      const dayInfo = getDayFromCellIndex(cellIndex, monthIndex);
      if (!dayInfo) return;
      
      // Check if it's a holiday or weekend - don't process those
      const date: CalendarDate = { year: dayInfo.year, month: dayInfo.month, day: dayInfo.day };
      if (isHolidayChecker(date) || dayOfWeek(date) === 'sat' || dayOfWeek(date) === 'sun') {
        return;
      }
      
      const dayKey = `${dayInfo.year}-${dayInfo.month}-${dayInfo.day}`;
      
      if (!touchedDaysSetRef.current.has(dayKey)) {
        touchedDaysSetRef.current.add(dayKey);
        hasNewDays = true;
        
        if (dragAction === 'add') {
          updateDayStatus(dayInfo.year, dayInfo.month, dayInfo.day, selectionMode);
        } else {
          updateDayStatus(dayInfo.year, dayInfo.month, dayInfo.day, null);
        }
      }
    });
    
    // Only trigger re-render if we found new days
    if (hasNewDays) {
      touchedDaysCountRef.current = touchedDaysSetRef.current.size;
    }
  };
  
  // High-performance mouse move handler for drag operations
  const handleCalendarMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !lastMousePosRef.current || !dragStartInfoRef.current) return;
    
    const currentPos = { x: e.clientX, y: e.clientY };
    const lastPos = lastMousePosRef.current;
    
    // Get all cells intersected by the line from last position to current position
    const intersectedCells = getLineIntersectedCells(
      lastPos.x, lastPos.y,
      currentPos.x, currentPos.y,
      dragStartInfoRef.current.monthIndex
    );
    
    if (intersectedCells.length > 0) {
      processTouchedDays(intersectedCells, dragStartInfoRef.current.monthIndex);
    }
    
    lastMousePosRef.current = currentPos;
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps


  // Generate year options (current year ± 3)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
  }, []);

  // Calculate days taken from calendar by type (only after hydration)
  const daysTakenByType = useMemo(() => {
    if (!isHydrated) {
      return {
        ferie: 0,
        permisjon_med_lonn: 0,
        permisjon_uten_lonn: 0
      };
    }

    const counts = {
      ferie: 0,
      permisjon_med_lonn: 0,
      permisjon_uten_lonn: 0
    };

    for (const [, status] of dayStates) {
      if (status && status in counts) {
        counts[status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [dayStates, isHydrated]);


  // Calculate actual work days in the year (excluding weekends and Norwegian holidays)
  const actualWorkDays = useMemo(() => {
    const holidays = getNorwegianHolidays(displayYear);
    let workDayCount = 0;

    for (let monthNum = 1; monthNum <= 12; monthNum++) {
      const daysInMonth = new Date(displayYear, monthNum, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const calendarDate: CalendarDate = { year: displayYear, month: monthName(monthNum), day };
        const weekDay = dayOfWeek(calendarDate);

        // Count Monday through Friday as potential work days
        if (weekDay !== 'sat' && weekDay !== 'sun') {
          // But exclude Norwegian public holidays
          if (!isNorwegianHoliday(calendarDate, holidays)) {
            workDayCount++;
          }
        }
      }
    }

    return workDayCount;
  }, [displayYear]);


  // High-performance global mouseup handler
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        draggedDaysRef.current = new Set();
        touchedDaysSetRef.current = new Set();
        touchedDaysCountRef.current = 0;
        lastMousePosRef.current = null;
        dragStartInfoRef.current = null;
        
        // Remove the global mouse move listener
        document.removeEventListener('mousemove', handleCalendarMouseMove);
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleCalendarMouseMove);
      };
    }
  }, [isDragging, handleCalendarMouseMove]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    };

    if (isYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isYearDropdownOpen]);

  const formatNumber = (value: string): string => {
    // Remove all non-digits
    const numericValue = value.replace(/\D/g, '');

    // Add spaces as thousands separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handleYearlyIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatNumber(value);
    setYearlyIncomeDisplay(formatted);
  };

  return (
    <div
      className="min-h-screen px-8 py-16"
      style={{ background: 'var(--background)' }}
    >
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 text-center">
          <h1
            className="text-5xl font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Feriepengekalulator
          </h1>
          <p
            className="text-lg opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            for deg som har fastlønn
          </p>
        </header>

        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Min nominelle årslønn er{' '}
              <input
                type="text"
                value={yearlyIncomeDisplay}
                onChange={handleYearlyIncomeChange}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '120px'
                }}
                placeholder="000 000"
              />
              {' '}kroner.
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Jeg jobber{' '}
              <input
                type="text"
                value={displayHoursPerDayText}
                onChange={(e) => {
                  const value = e.target.value;
                  setHoursPerDayDisplay(value);

                  if (value === '') {
                    setHoursPerDay(null);
                  } else {
                    const normalizedValue = value.replace(',', '.');
                    const numValue = parseFloat(normalizedValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setHoursPerDay(numValue);
                    }
                  }
                }}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '50px'
                }}
                placeholder="7,5"
                step="0.1"
              />
              {' '}timer per dag
              {displayHoursPerDay && (
                <span className="opacity-50 animate-fadeInToHalf"> (for en {(displayHoursPerDay * 5).toString().replace('.', ',')} timer arbeidsuke)</span>
              )}
              .
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Jeg får{' '}
              <input
                type="text"
                value={displayVacationPayText}
                onChange={(e) => {
                  const value = e.target.value;
                  setVacationPayDisplay(value);

                  if (value === '') {
                    setVacationPay(null);
                  } else {
                    const normalizedValue = value.replace(',', '.');
                    const numValue = parseFloat(normalizedValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setVacationPay(numValue);
                    }
                  }
                }}
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '40px'
                }}
                placeholder="12"
              />
              {' '}% i feriepenger.
            </p>
          </div>

        </div>

        {/* Selection Mode Toggle */}
        <div className="mt-16 mb-8 text-center">
          <div className="text-xl leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            Klikk og dra over dager for å markere{' '}
            <button
              onClick={cycleSelectionMode}
              className={`inline-block bg-transparent border-0 border-b border-solid focus:outline-none mx-1 cursor-pointer font-medium hover:opacity-70 transition-all ${getSelectionModeColor()}`}
              style={{
                borderBottomColor: 'var(--input-border)',
                fontSize: 'inherit',
                fontFamily: 'inherit'
              }}
            >
              {getSelectionModeText()}
            </button>
            {' '}i{' '}
            <span className="inline-block relative mx-1" ref={dropdownRef}>
              <button
                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                className="bg-transparent border-0 border-b border-solid focus:outline-none text-center cursor-pointer salary-input hover:opacity-70 transition-opacity"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '60px'
                }}
              >
                {displayYear}
              </button>
              {isYearDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10"
                  style={{ minWidth: '80px' }}
                >
                  {yearOptions.map(yearOption => (
                    <button
                      key={yearOption}
                      data-year={yearOption}
                      onClick={() => {
                        setYear(yearOption);
                        setIsYearDropdownOpen(false);
                      }}
                      className={`block w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors ${yearOption === displayYear ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      style={{
                        color: 'var(--text-primary)',
                        fontSize: 'inherit',
                        fontFamily: 'inherit'
                      }}
                    >
                      {yearOption}
                    </button>
                  ))}
                </div>
              )}
            </span>
            .
            <div className="h-6 mt-2">
              {selectionMode === 'permisjon_med_lonn' && (
                <span className="block text-sm opacity-60 transition-opacity duration-200"> (betalt permisjon påvirker ikke utbetalingen, men gir høyere timelønn)</span>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Grid with high-performance drag system */}
        <div 
          className="calendar-container relative"
          onMouseDown={(e) => {
            const dayElement = (e.target as Element).closest('.calendar-day');
            if (dayElement) {
              const dayKey = dayElement.getAttribute('data-day-key');
              const monthElement = dayElement.closest('[data-month-index]');
              const monthIndex = monthElement ? parseInt(monthElement.getAttribute('data-month-index') || '0') : 0;
              
              if (dayKey) {
                const [year, month, day] = dayKey.split('-');
                
                // Set initial mouse position for accurate line intersection
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                
                handleDayInteraction(parseInt(year), month, parseInt(day), monthIndex);
              }
            }
          }}
          onMouseOver={(e) => {
            // Legacy fallback for browsers that might miss mousemove events
            if (isDragging) {
              const dayElement = (e.target as Element).closest('.calendar-day');
              if (dayElement) {
                const dayKey = dayElement.getAttribute('data-day-key');
                const monthElement = dayElement.closest('[data-month-index]');
                const monthIndex = monthElement ? parseInt(monthElement.getAttribute('data-month-index') || '0') : 0;
                
                if (dayKey) {
                  const [year, month, day] = dayKey.split('-');
                  handleDayInteraction(parseInt(year), month, parseInt(day), monthIndex);
                }
              }
            }
          }}
        >
          <div className={`
            grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-1
            transition-all duration-300 ease-in-out
            ${(isHydrated && isCalendarReady) ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Always show some content to maintain layout - exact Month structure */}
            {!isHydrated && Array.from({ length: 12 }, (_, i) => (
              <div key={`placeholder-${i}`} className="p-4">
                {/* Month header - matches Month.tsx exactly */}
                <div className="text-center mb-4">
                  <h3 className="font-medium text-lg capitalize opacity-0">
                    månednavn
                  </h3>
                </div>

                {/* Calendar grid - exactly 6 rows always (42 cells) */}
                <div className="grid grid-cols-7 calendar-grid">
                  {Array.from({ length: 42 }, (_, j) => (
                    <div
                      key={j}
                      className="calendar-day flex items-center justify-center text-sm opacity-0"
                    >
                      {j > 2 && j < 33 ? j - 2 : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Real calendar with month indices for high-performance drag */}
            {isHydrated && months.map((month, index) => (
              <div key={`${calendarKey}-${index}`} data-month-index={index}>
                <Month
                  month={month}
                  getDayStatus={getDayStatus}
                  isHoliday={isHolidayChecker}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Elegant divider */}
        <div className="mt-6 mb-8 flex justify-center">
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
        </div>

        {/* Calculation section */}
        <div className="grid md:grid-cols-2 gap-4 text-center md:text-left">
          <div>
            <p className="text-lg leading-relaxed text-opacity-90" style={{ color: 'var(--text-primary)' }}>
              Det er vanlig å regne 260 arbeidsdager per år, som med din arbeidsuke gir{' '}
              {isHydrated && displayHoursPerDay && (
                <span className="font-medium text-opacity-100">
                  {(displayHoursPerDay * 5 * 52).toLocaleString('nb-NO').replace(/\./g, ',')} timer per år
                </span>
              )}
              {isHydrated && !displayHoursPerDay && <span className="text-opacity-50">0 timer per år</span>}
              {!isHydrated && <span className="text-opacity-50">... timer per år</span>}
              .
            </p>

            {isHydrated && yearlyIncomeDisplay && displayHoursPerDay && (
              <p className="text-lg leading-relaxed mt-4 text-opacity-90" style={{ color: 'var(--text-primary)' }}>
                Din nominelle timelønn er{' '}
                <span className="font-medium text-opacity-100">
                  {Math.round(
                    (parseFloat(yearlyIncomeDisplay.replace(/\s/g, '')) || 0) /
                    (displayHoursPerDay * 5 * 52)
                  ).toLocaleString('nb-NO')} kroner per time
                </span>
                .
              </p>
            )}

          </div>

          {/* Vertical divider - hidden on mobile */}
          <div className="hidden md:block absolute left-1/2 w-px h-20 bg-gradient-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent transform -translate-x-1/2"></div>

          <div className="pl-8">
            <p className="text-lg leading-relaxed text-opacity-90" style={{ color: 'var(--text-primary)' }}>
              I {isHydrated ? displayYear : new Date().getFullYear()} er det faktisk{' '}
              <span className="font-medium text-opacity-100">
                {isHydrated ? actualWorkDays.toLocaleString('nb-NO') : '...'} arbeidsdager
              </span>
              {isHydrated && displayHoursPerDay && (
                <span>
                  {' '}som {(() => {
                    const currentYear = new Date().getFullYear();
                    if (displayYear < currentYear) return 'tilsvarte';
                    if (displayYear > currentYear) return 'kommer til å tilsvare';
                    return 'tilsvarer';
                  })()}{' '}
                  <span className="font-medium text-opacity-100">
                    {(actualWorkDays * displayHoursPerDay).toLocaleString('nb-NO').replace(/\./g, ',')} tilgjengelige arbeidstimer i året
                  </span>
                </span>
              )}
              .
            </p>

            {/* Reserve space for vacation days display */}
            <div className="mt-4 space-y-2 min-h-[4rem]">
              {isHydrated && (daysTakenByType.ferie > 0 || daysTakenByType.permisjon_med_lonn > 0 || daysTakenByType.permisjon_uten_lonn > 0) && (
                <>
                  {daysTakenByType.ferie > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {daysTakenByType.ferie} dager ferie
                      </span>
                    </p>
                  )}

                  {daysTakenByType.permisjon_med_lonn > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {daysTakenByType.permisjon_med_lonn} dager betalt permisjon
                      </span>
                    </p>
                  )}

                  {daysTakenByType.permisjon_uten_lonn > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        {daysTakenByType.permisjon_uten_lonn} dager fri uten lønn
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Reserve space for salary calculations */}
            <div className="mt-6 min-h-[8rem]">
              {isHydrated && yearlyIncomeDisplay && displayHoursPerDay && displayVacationPay && (
                <>
                  {(() => {
                  const actualHoursWorked = (actualWorkDays - daysTakenByType.ferie - daysTakenByType.permisjon_med_lonn - daysTakenByType.permisjon_uten_lonn) * displayHoursPerDay;
                  const nominalSalary = parseFloat(yearlyIncomeDisplay.replace(/\s/g, '')) || 0;
                  const nominalHourlyRate = nominalSalary / (displayHoursPerDay * 5 * 52);
                  
                  // Calculate actual earnings based on selected method
                  let actualEarnings: number;
                  let calculationExplanation: string;
                  
                  // Unpaid leave reduces the salary base for calculating vacation pay
                  const unpaidLeaveDeduction = daysTakenByType.permisjon_uten_lonn * displayHoursPerDay * nominalHourlyRate;
                  
                  switch (calculationMethod) {
                    case 'standard':
                      const standardBase = (nominalSalary * 11/12) - unpaidLeaveDeduction;
                      actualEarnings = standardBase + (standardBase * (displayVacationPay/100));
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0 
                        ? `faktisk årslønn = (11/12 av nominell lønn - fri uten lønn*) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = 11/12 av nominell lønn + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'generous':
                      const generousBase = nominalSalary - unpaidLeaveDeduction;
                      actualEarnings = generousBase + (generousBase * (displayVacationPay/100));
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (full nominell lønn - fri uten lønn*) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = full nominell lønn + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'stingy':
                      const vacationDeduction = daysTakenByType.ferie * displayHoursPerDay * nominalHourlyRate;
                      const stingyBase = nominalSalary - vacationDeduction - unpaidLeaveDeduction;
                      actualEarnings = stingyBase + (stingyBase * (displayVacationPay/100));
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (nominell lønn - feriedager - fri uten lønn*) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = (nominell lønn - feriedager) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'anal':
                      const realHourlyRate = nominalSalary / (actualWorkDays * displayHoursPerDay);
                      const allLeaveDeduction = (daysTakenByType.ferie + daysTakenByType.permisjon_uten_lonn) * displayHoursPerDay * realHourlyRate;
                      const analBase = nominalSalary - allLeaveDeduction;
                      actualEarnings = analBase + (analBase * (displayVacationPay/100));
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (nominell lønn - alle fridager*) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger (basert på faktiske arbeidsdager)`
                        : `faktisk årslønn = (nominell lønn - feriedager) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger (basert på faktiske arbeidsdager)`;
                      break;
                    default:
                      const defaultBase = (nominalSalary * 11/12) - unpaidLeaveDeduction;
                      actualEarnings = defaultBase + (defaultBase * (displayVacationPay/100));
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (11/12 av nominell lønn - fri uten lønn*) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = 11/12 av nominell lønn + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                  }
                  
                  const actualHourlyRate = actualHoursWorked > 0 ? actualEarnings / actualHoursWorked : 0;

                  const currentYear = new Date().getFullYear();
                  const hasVacationOrUnpaid = daysTakenByType.ferie > 0 || daysTakenByType.permisjon_uten_lonn > 0;

                  return (
                    <>
                      <p className="text-lg leading-relaxed text-opacity-90" style={{ color: 'var(--text-primary)' }}>
                        {displayYear < currentYear ? 'Du jobbet egentlig' : 'Du kommer egentlig til å jobbe'}{' '}
                        <span className="font-medium text-opacity-100">
                          {actualHoursWorked.toLocaleString('nb-NO').replace(/\./g, ',')} timer
                        </span>
                        {!hasVacationOrUnpaid && (
                          <span className="font-medium text-blue-600 dark:text-blue-400"> (du tok ingen ferie)</span>
                        )}
                        .
                      </p>
                      <p className="text-lg leading-relaxed mt-4 text-opacity-90" style={{ color: 'var(--text-primary)' }}>
                        Din faktiske årslønn blir{' '}
                        <span className="font-medium text-opacity-100">
                          {Math.round(actualEarnings).toLocaleString('nb-NO')} kroner
                        </span>
                        <span className="opacity-60"> (som gir en reell timelønn på {Math.round(actualHourlyRate).toLocaleString('nb-NO')} kr/time for timene du faktisk jobbet)</span>
                        .
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm opacity-70 hover:opacity-100">
                          Endre beregning (avansert)
                        </summary>
                        <div className="mt-4 space-y-3">
                          <div className="space-y-3">
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <div className="custom-radio">
                                <input
                                  type="radio"
                                  name="calculationMethod"
                                  value="standard"
                                  checked={calculationMethod === 'standard'}
                                  onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy' | 'anal')}
                                />
                                <div className="custom-radio-circle"></div>
                              </div>
                              <span className="text-sm">
                                Arbeidsgiveren min betaler meg 1/12 av lønnen 11 ganger + {displayVacationPay.toString().replace('.', ',')}% feriepenger
                              </span>
                            </label>
                            
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <div className="custom-radio">
                                <input
                                  type="radio"
                                  name="calculationMethod"
                                  value="generous"
                                  checked={calculationMethod === 'generous'}
                                  onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy' | 'anal')}
                                />
                                <div className="custom-radio-circle"></div>
                              </div>
                              <span className="text-sm">
                                Arbeidsgiveren min er snill og betaler meg 1/11 av lønnen 11 ganger (altså hele den nominelle lønnen) + {displayVacationPay.toString().replace('.', ',')}% feriepenger
                              </span>
                            </label>
                            
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <div className="custom-radio">
                                <input
                                  type="radio"
                                  name="calculationMethod"
                                  value="stingy"
                                  checked={calculationMethod === 'stingy'}
                                  onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy' | 'anal')}
                                />
                                <div className="custom-radio-circle"></div>
                              </div>
                              <span className="text-sm">
                                Arbeidsgiveren min er kjip og trekker meg for all ferien jeg tar
                              </span>
                            </label>
                            
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <div className="custom-radio">
                                <input
                                  type="radio"
                                  name="calculationMethod"
                                  value="anal"
                                  checked={calculationMethod === 'anal'}
                                  onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy' | 'anal')}
                                />
                                <div className="custom-radio-circle"></div>
                              </div>
                              <span className="text-sm">
                                Arbeidsgiveren min er pedantisk og regner ut timelønnen basert på faktiske arbeidsdager i året
                              </span>
                            </label>
                          </div>
                          
                          <p className="text-xs mt-3 opacity-70 border-t pt-2">
                            {calculationExplanation}
                          </p>
                          {daysTakenByType.permisjon_uten_lonn > 0 && (
                            <p className="text-xs mt-2 opacity-60">
                              * fri uten lønn beregnes med nominell timelønn ({Math.round(nominalHourlyRate).toLocaleString('nb-NO')} kr/time)
                            </p>
                          )}
                        </div>
                      </details>
                    </>
                  );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-12 text-center">
          <div className="mb-8">
            <span
              onClick={() => {
                // Reset global form fields
                setYearlyIncomeDisplay('');
                setVacationPay(null);
                setVacationPayDisplay('');
                setHoursPerDay(null);
                setHoursPerDayDisplay('');

                // Clear current year's day states
                setDayStatesObj({});
              }}
              className="text-sm text-red-600 dark:text-red-400 hover:underline cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              tilbakestill dette skjemaet
            </span>
          </div>
          <p
            className="text-sm italic mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Lønnskalkulatoren &nbsp;&nbsp;·&nbsp;&nbsp; laga med kjærleik og claude code
          </p>
        </footer>
      </div>
    </div>
  );
}
