'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CalendarMonth, monthName, CalendarDate, addDays, dayOfWeek, datesEqual } from 'typescript-calendar-date';
import Month from '@/components/Month';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type DayStatus = 'ferie' | 'permisjon_med_lonn' | 'permisjon_uten_lonn' | 'foreldrepermisjon' | 'foreldrepermisjon_80' | 'sykemelding' | null;

// Norwegian social security base amount (grunnbeløp) historical data and estimation
const GRUNNBELOP_HISTORICAL: Record<number, number> = {
  2020: 101351,
  2021: 106399,
  2022: 111477,
  2023: 118620,
  2024: 124028,
  2025: 130160,
};

// Calculate average yearly growth rate from historical data
const calculateAverageGrowthRate = (): number => {
  const years = Object.keys(GRUNNBELOP_HISTORICAL).map(Number).sort();
  const growthRates: number[] = [];
  
  for (let i = 1; i < years.length; i++) {
    const prevYear = years[i - 1];
    const currentYear = years[i];
    const growthRate = (GRUNNBELOP_HISTORICAL[currentYear] - GRUNNBELOP_HISTORICAL[prevYear]) / GRUNNBELOP_HISTORICAL[prevYear];
    growthRates.push(growthRate);
  }
  
  return growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
};

// Get grunnbeløp for a specific year (historical or estimated)
const getGrunnbelopForYear = (year: number): number => {
  // Return historical value if available
  if (GRUNNBELOP_HISTORICAL[year]) {
    return GRUNNBELOP_HISTORICAL[year];
  }
  
  // Estimate for future years based on average growth rate
  const lastKnownYear = Math.max(...Object.keys(GRUNNBELOP_HISTORICAL).map(Number));
  const lastKnownValue = GRUNNBELOP_HISTORICAL[lastKnownYear];
  const averageGrowthRate = calculateAverageGrowthRate();
  const yearsToProject = year - lastKnownYear;
  
  if (yearsToProject > 0) {
    // Project forward using compound growth
    return Math.round(lastKnownValue * Math.pow(1 + averageGrowthRate, yearsToProject));
  } else {
    // For years before our historical data, use backwards projection
    const firstKnownYear = Math.min(...Object.keys(GRUNNBELOP_HISTORICAL).map(Number));
    const firstKnownValue = GRUNNBELOP_HISTORICAL[firstKnownYear];
    const yearsToBackProject = firstKnownYear - year;
    return Math.round(firstKnownValue / Math.pow(1 + averageGrowthRate, yearsToBackProject));
  }
};

// Get 6G for a specific year
const get6GForYear = (year: number): number => {
  return 6 * getGrunnbelopForYear(year);
};

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
  const [vacationPay, setVacationPay] = useLocalStorage<number>('vacationPay', 12);
  const [vacationPayDisplay, setVacationPayDisplay] = useLocalStorage<string>('vacationPayDisplay', '12');
  const [hoursPerDay, setHoursPerDay] = useLocalStorage<number>('hoursPerDay', 7.5);
  const [hoursPerDayDisplay, setHoursPerDayDisplay] = useLocalStorage<string>('hoursPerDayDisplay', '7,5');
  
  // Foreldrepermisjon settings
  const [employerCoversAbove6G, setEmployerCoversAbove6G] = useLocalStorage<boolean>('employerCoversAbove6G', false);
  
  // Sykemelding settings
  const [employerCoversSykeAbove6G, setEmployerCoversSykeAbove6G] = useLocalStorage<boolean>('employerCoversSykeAbove6G', false);
  const [employerPaysVacationOnNavSick, setEmployerPaysVacationOnNavSick] = useLocalStorage<boolean>('employerPaysVacationOnNavSick', false);

  // Track hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use current year for server rendering to avoid hydration mismatch
  const displayYear = isHydrated ? year : new Date().getFullYear();

  // Server render as empty, client shows localStorage OR defaults with fade-in
  const displayVacationPay = isHydrated ? vacationPay : null;
  const displayVacationPayText = isHydrated ? vacationPayDisplay : '';
  const displayHoursPerDay = isHydrated ? hoursPerDay : null;
  const displayHoursPerDayText = isHydrated ? hoursPerDayDisplay : '';
  const displayYearlyIncomeText = isHydrated ? yearlyIncomeDisplay : '';


  // Ref for dropdown click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track selected days: key is "year-month-day", value is the status
  const [dayStatesObj, setDayStatesObj] = useLocalStorage<Record<string, DayStatus>>('dayStates', {}, displayYear);
  const [isCalendarReady, setIsCalendarReady] = useState(false);

  // Convert to Map for easier usage
  const dayStates = useMemo(() => new Map(Object.entries(dayStatesObj)), [dayStatesObj]);
  const setDayStates = useCallback((updateFn: (prev: Map<string, DayStatus>) => Map<string, DayStatus>) => {
    const prevMap = new Map(Object.entries(dayStatesObj));
    const newMap = updateFn(prevMap);
    setDayStatesObj(Object.fromEntries(newMap.entries()));
  }, [dayStatesObj, setDayStatesObj]);

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
    const date: CalendarDate = { year, month: month as ReturnType<typeof monthName>, day };
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
            const firstDayOfWeek = dayOfWeek({ year, month: month as ReturnType<typeof monthName>, day: 1 });
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
      case 'foreldrepermisjon':
        return 'foreldrepermisjon (100%)';
      case 'foreldrepermisjon_80':
        return 'foreldrepermisjon (80%)';
      case 'sykemelding':
        return 'sykemelding';
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
      case 'foreldrepermisjon':
        return 'text-purple-600 dark:text-purple-400';
      case 'foreldrepermisjon_80':
        return 'text-pink-600 dark:text-pink-400';
      case 'sykemelding':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  // Cycle through selection modes
  const cycleSelectionMode = () => {
    switch (selectionMode) {
      case 'ferie':
        setSelectionMode('foreldrepermisjon');
        break;
      case 'foreldrepermisjon':
        setSelectionMode('foreldrepermisjon_80');
        break;
      case 'foreldrepermisjon_80':
        setSelectionMode('permisjon_med_lonn');
        break;
      case 'permisjon_med_lonn':
        setSelectionMode('permisjon_uten_lonn');
        break;
      case 'permisjon_uten_lonn':
        setSelectionMode('sykemelding');
        break;
      case 'sykemelding':
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
        permisjon_uten_lonn: 0,
        foreldrepermisjon: 0,
        foreldrepermisjon_80: 0,
        sykemelding: 0
      };
    }

    const counts = {
      ferie: 0,
      permisjon_med_lonn: 0,
      permisjon_uten_lonn: 0,
      foreldrepermisjon: 0,
      foreldrepermisjon_80: 0,
      sykemelding: 0
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

  // Auto-fill vacation days
  const fillVacationWeeks = (weeks: number) => {
    const daysToMark = weeks * 5; // 5 work days per week
    let markedDays = 0;
    const newDayStates = new Map(dayStates);
    
    // Iterate through months and mark weekdays as vacation
    for (let monthNum = 1; monthNum <= 12 && markedDays < daysToMark; monthNum++) {
      const daysInMonth = new Date(displayYear, monthNum, 0).getDate();
      
      for (let day = 1; day <= daysInMonth && markedDays < daysToMark; day++) {
        const calendarDate: CalendarDate = { year: displayYear, month: monthName(monthNum), day };
        const weekDay = dayOfWeek(calendarDate);
        const dayKey = getDayKey(displayYear, monthName(monthNum), day);
        
        // Only mark weekdays that aren't holidays and aren't already marked
        if (weekDay !== 'sat' && weekDay !== 'sun' && 
            !isHolidayChecker(calendarDate) && 
            !newDayStates.has(dayKey)) {
          newDayStates.set(dayKey, 'ferie');
          markedDays++;
        }
      }
    }
    
    setDayStatesObj(Object.fromEntries(newDayStates.entries()));
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
                value={displayYearlyIncomeText}
                onChange={handleYearlyIncomeChange}
                className={`inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input transition-opacity duration-500 ${isHydrated ? 'opacity-100' : 'opacity-0'}`}
                placeholder="000 000"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '120px'
                }}
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
                    setHoursPerDay(7.5);
                    setHoursPerDayDisplay('7,5');
                  } else {
                    const normalizedValue = value.replace(',', '.');
                    const numValue = parseFloat(normalizedValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setHoursPerDay(numValue);
                    }
                  }
                }}
                className={`inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input transition-opacity duration-500 ${isHydrated ? 'opacity-100' : 'opacity-0'}`}
                placeholder="7,5"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '50px'
                }}
                step="0.1"
              />
              {' '}timer per dag
              {isHydrated && displayHoursPerDay && (
                <span className="opacity-50 animate-fadeInToHalf transition-opacity duration-500"> (for en {(displayHoursPerDay * 5).toString().replace('.', ',')} timer arbeidsuke)</span>
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
                    setVacationPay(12);
                    setVacationPayDisplay('12');
                  } else {
                    const normalizedValue = value.replace(',', '.');
                    const numValue = parseFloat(normalizedValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setVacationPay(numValue);
                    }
                  }
                }}
                className={`inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input transition-opacity duration-500 ${isHydrated ? 'opacity-100' : 'opacity-0'}`}
                placeholder="12"
                style={{
                  borderBottomColor: 'var(--input-border)',
                  color: 'var(--text-primary)',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  width: '40px'
                }}
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
                className={`bg-transparent border-0 border-b border-solid focus:outline-none text-center cursor-pointer salary-input hover:opacity-70 transition-opacity duration-500 ${isHydrated ? 'opacity-100' : 'opacity-0'}`}
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
            <div className="min-h-[1.5rem] mt-2">
              {selectionMode === 'permisjon_med_lonn' && (
                <span className="block text-sm opacity-60 transition-opacity duration-200"> (betalt permisjon påvirker ikke utbetalingen, men gir høyere timelønn)</span>
              )}
              {(selectionMode === 'foreldrepermisjon' || selectionMode === 'foreldrepermisjon_80') && (
                <span className="block text-sm opacity-60 transition-opacity duration-200"> (Nav dekker opp til 6G, se avansert innstilling dersom din arbeidsgiver dekker mellomlegg)</span>
              )}
              {isHydrated && selectionMode === 'ferie' && daysTakenByType.ferie === 0 && (
                <span className="block text-sm opacity-60 transition-opacity duration-200">
                  {' '}(fyll ut fellesferien med{' '}
                  <button
                    onClick={() => fillVacationWeeks(4)}
                    className="underline hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-blue-500 dark:text-blue-300 opacity-80"
                  >
                    4 uker
                  </button>
                  {' '}eller{' '}
                  <button
                    onClick={() => fillVacationWeeks(5)}
                    className="underline hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-blue-500 dark:text-blue-300 opacity-80"
                  >
                    5 uker
                  </button>
                  )
                </span>
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
                <span className="font-medium text-opacity-100 transition-opacity duration-500">
                  {(displayHoursPerDay * 5 * 52).toLocaleString('nb-NO').replace(/\./g, ',')} timer per år
                </span>
              )}
              {!isHydrated && <span className="text-opacity-0">... timer per år</span>}
              .
            </p>

            {isHydrated && displayYearlyIncomeText && displayHoursPerDay && (
              <p className="text-lg leading-relaxed mt-4 text-opacity-90 transition-opacity duration-500" style={{ color: 'var(--text-primary)' }}>
                Din nominelle timelønn er{' '}
                <span className="font-medium text-opacity-100 transition-opacity duration-500">
                  {Math.round(
                    (parseFloat(displayYearlyIncomeText.replace(/\s/g, '')) || 0) /
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
              {isHydrated && (daysTakenByType.ferie > 0 || daysTakenByType.permisjon_med_lonn > 0 || daysTakenByType.permisjon_uten_lonn > 0 || daysTakenByType.foreldrepermisjon > 0 || daysTakenByType.foreldrepermisjon_80 > 0 || daysTakenByType.sykemelding > 0) && (
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

                  {daysTakenByType.foreldrepermisjon > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-purple-600 dark:text-purple-400">
                        {daysTakenByType.foreldrepermisjon} dager foreldrepermisjon (100%)
                      </span>
                    </p>
                  )}

                  {daysTakenByType.foreldrepermisjon_80 > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-pink-600 dark:text-pink-400">
                        {daysTakenByType.foreldrepermisjon_80} dager foreldrepermisjon (80%)
                      </span>
                    </p>
                  )}

                  {daysTakenByType.sykemelding > 0 && (
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {daysTakenByType.sykemelding} dager sykemelding
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Reserve space for salary calculations */}
            <div className="mt-6 min-h-[8rem]">
              {isHydrated && displayYearlyIncomeText && displayHoursPerDay && displayVacationPay && (
                <>
                  {(() => {
                  const actualHoursWorked = (actualWorkDays - daysTakenByType.ferie - daysTakenByType.permisjon_med_lonn - daysTakenByType.permisjon_uten_lonn - daysTakenByType.foreldrepermisjon - daysTakenByType.foreldrepermisjon_80 - daysTakenByType.sykemelding) * displayHoursPerDay;
                  const nominalSalary = parseFloat(displayYearlyIncomeText.replace(/\s/g, '')) || 0;
                  const nominalHourlyRate = nominalSalary / (displayHoursPerDay * 5 * 52);
                  
                  // Calculate actual earnings based on selected method
                  let actualEarnings: number;
                  let calculationExplanation: string;
                  
                  // Unpaid leave reduces the salary base for calculating vacation pay
                  const unpaidLeaveDeduction = daysTakenByType.permisjon_uten_lonn * displayHoursPerDay * nominalHourlyRate;
                  
                  // Calculate foreldrepermisjon compensation
                  const calculateForeldrepermisjonPay = () => {
                    let totalForeldrePay = 0;
                    let totalForeldreFromEmployer = 0;
                    
                    // Get 6G value for the selected year
                    const sixGForYear = get6GForYear(displayYear);
                    
                    // Regular foreldrepermisjon (100%)
                    if (daysTakenByType.foreldrepermisjon > 0) {
                      const dailyRate = nominalHourlyRate * displayHoursPerDay;
                      const navPaysUpTo6G = Math.min(nominalSalary, sixGForYear) / (actualWorkDays);
                      const employerPaysAbove6G = employerCoversAbove6G ? Math.max(0, dailyRate - navPaysUpTo6G) : 0;
                      
                      totalForeldrePay += daysTakenByType.foreldrepermisjon * navPaysUpTo6G;
                      totalForeldreFromEmployer += daysTakenByType.foreldrepermisjon * employerPaysAbove6G;
                    }
                    
                    // 80% foreldrepermisjon (spread over 125% time, but same total amount)
                    if (daysTakenByType.foreldrepermisjon_80 > 0) {
                      const dailyRate = nominalHourlyRate * displayHoursPerDay;
                      const navPaysUpTo6G = Math.min(nominalSalary, sixGForYear) / (actualWorkDays);
                      const employerPaysAbove6G = employerCoversAbove6G ? Math.max(0, dailyRate - navPaysUpTo6G) : 0;
                      
                      // 80% gets same total Nav support, but additional unpaid days
                      totalForeldrePay += daysTakenByType.foreldrepermisjon_80 * navPaysUpTo6G;
                      totalForeldreFromEmployer += daysTakenByType.foreldrepermisjon_80 * employerPaysAbove6G;
                    }
                    
                    return { navPay: totalForeldrePay, employerPay: totalForeldreFromEmployer };
                  };
                  
                  const foreldreComp = calculateForeldrepermisjonPay();
                  
                  // Calculate sykemelding compensation (complex 48-day vacation pay limit)
                  const calculateSykemeldingPay = () => {
                    if (daysTakenByType.sykemelding === 0) {
                      return { navPay: 0, navVacationPay: 0, employerPay: 0, employerVacationPay: 0 };
                    }
                    
                    const sixGForYear = get6GForYear(displayYear);
                    const dailyRate = nominalHourlyRate * displayHoursPerDay;
                    const navDailyRate = Math.min(nominalSalary, sixGForYear) / actualWorkDays;
                    const employerDailyRate = employerCoversSykeAbove6G ? Math.max(0, dailyRate - navDailyRate) : 0;
                    
                    // Nav pays all sick days up to 6G
                    const navPay = daysTakenByType.sykemelding * navDailyRate;
                    const employerPay = daysTakenByType.sykemelding * employerDailyRate;
                    
                    // Vacation pay logic: Nav only pays vacation on first 48 days
                    const first48Days = Math.min(daysTakenByType.sykemelding, 48);
                    const beyond48Days = Math.max(0, daysTakenByType.sykemelding - 48);
                    
                    // Nav vacation pay: only on first 48 days
                    const navVacationPay = (first48Days * navDailyRate) * (displayVacationPay / 100);
                    
                    // Employer vacation pay calculation
                    let employerVacationPay = 0;
                    if (employerCoversSykeAbove6G) {
                      // Employer always pays vacation on their portion (above 6G)
                      employerVacationPay += (daysTakenByType.sykemelding * employerDailyRate) * (displayVacationPay / 100);
                    }
                    
                    if (employerPaysVacationOnNavSick && beyond48Days > 0) {
                      // If employer covers Nav portion vacation pay after 48 days
                      employerVacationPay += (beyond48Days * navDailyRate) * (displayVacationPay / 100);
                    }
                    
                    return { 
                      navPay, 
                      navVacationPay, 
                      employerPay, 
                      employerVacationPay 
                    };
                  };
                  
                  const sykeComp = calculateSykemeldingPay();
                  
                  switch (calculationMethod) {
                    case 'standard':
                      const standardBase = (nominalSalary * 11/12) - unpaidLeaveDeduction;
                      const standardVacationBase = standardBase + foreldreComp.employerPay + sykeComp.employerPay;
                      actualEarnings = standardVacationBase + (standardVacationBase * (displayVacationPay/100)) + foreldreComp.navPay + sykeComp.navPay + sykeComp.navVacationPay + sykeComp.employerVacationPay;
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0 
                        ? `faktisk årslønn = (11/12 av nominell lønn - fri uten lønn* + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = 11/12 av nominell lønn + foreldrepermisjon + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'generous':
                      const generousBase = nominalSalary - unpaidLeaveDeduction;
                      const generousVacationBase = generousBase + foreldreComp.employerPay + sykeComp.employerPay;
                      actualEarnings = generousVacationBase + (generousVacationBase * (displayVacationPay/100)) + foreldreComp.navPay + sykeComp.navPay + sykeComp.navVacationPay + sykeComp.employerVacationPay;
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (full nominell lønn - fri uten lønn* + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = full nominell lønn + foreldrepermisjon + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'stingy':
                      const vacationDeduction = daysTakenByType.ferie * displayHoursPerDay * nominalHourlyRate;
                      const stingyBase = nominalSalary - vacationDeduction - unpaidLeaveDeduction;
                      const stingyVacationBase = stingyBase + foreldreComp.employerPay + sykeComp.employerPay;
                      actualEarnings = stingyVacationBase + (stingyVacationBase * (displayVacationPay/100)) + foreldreComp.navPay + sykeComp.navPay + sykeComp.navVacationPay + sykeComp.employerVacationPay;
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (nominell lønn - feriedager - fri uten lønn* + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = (nominell lønn - feriedager + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                      break;
                    case 'anal':
                      const realHourlyRate = nominalSalary / (actualWorkDays * displayHoursPerDay);
                      const allLeaveDeduction = (daysTakenByType.ferie + daysTakenByType.permisjon_uten_lonn) * displayHoursPerDay * realHourlyRate;
                      const analBase = nominalSalary - allLeaveDeduction;
                      const analVacationBase = analBase + foreldreComp.employerPay + sykeComp.employerPay;
                      actualEarnings = analVacationBase + (analVacationBase * (displayVacationPay/100)) + foreldreComp.navPay + sykeComp.navPay + sykeComp.navVacationPay + sykeComp.employerVacationPay;
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (nominell lønn - alle fridager* + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger (basert på faktiske arbeidsdager)`
                        : `faktisk årslønn = (nominell lønn - feriedager + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger (basert på faktiske arbeidsdager)`;
                      break;
                    default:
                      const defaultBase = (nominalSalary * 11/12) - unpaidLeaveDeduction;
                      const defaultVacationBase = defaultBase + foreldreComp.employerPay + sykeComp.employerPay;
                      actualEarnings = defaultVacationBase + (defaultVacationBase * (displayVacationPay/100)) + foreldreComp.navPay + sykeComp.navPay + sykeComp.navVacationPay + sykeComp.employerVacationPay;
                      calculationExplanation = daysTakenByType.permisjon_uten_lonn > 0
                        ? `faktisk årslønn = (11/12 av nominell lønn - fri uten lønn* + foreldrepermisjon) + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`
                        : `faktisk årslønn = 11/12 av nominell lønn + foreldrepermisjon + ${displayVacationPay.toString().replace('.', ',')}% feriepenger`;
                  }
                  
                  const actualHourlyRate = actualHoursWorked > 0 ? actualEarnings / actualHoursWorked : 0;

                  const currentYear = new Date().getFullYear();
                  const hasVacationOrUnpaid = daysTakenByType.ferie > 0 || daysTakenByType.permisjon_uten_lonn > 0 || daysTakenByType.foreldrepermisjon > 0 || daysTakenByType.foreldrepermisjon_80 > 0 || daysTakenByType.sykemelding > 0;

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
                        <span className="font-medium text-opacity-100 transition-opacity duration-500">
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
                          
                          {/* Employer coverage for foreldrepermisjon */}
                          {(daysTakenByType.foreldrepermisjon > 0 || daysTakenByType.foreldrepermisjon_80 > 0) && (
                            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <label className="flex items-start space-x-3 cursor-pointer">
                                <div className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={employerCoversAbove6G}
                                    onChange={(e) => setEmployerCoversAbove6G(e.target.checked)}
                                    className="sr-only"
                                  />
                                  <div className={`w-4 h-4 border-2 rounded transition-colors ${employerCoversAbove6G ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {employerCoversAbove6G && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm">
                                  Arbeidsgiveren min dekker lønn over 6G under foreldrepermisjon (bare arbeidsgiverens del gir feriepenger)
                                </span>
                              </label>
                            </div>
                          )}
                          
                          {/* Sykemelding employer coverage options */}
                          {daysTakenByType.sykemelding > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <label className="flex items-start space-x-3 cursor-pointer mb-3">
                                <div className="custom-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={employerCoversSykeAbove6G}
                                    onChange={(e) => setEmployerCoversSykeAbove6G(e.target.checked)}
                                    className="sr-only"
                                  />
                                  <div className={`w-4 h-4 border-2 rounded transition-colors ${employerCoversSykeAbove6G ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {employerCoversSykeAbove6G && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm">
                                  Arbeidsgiveren min dekker lønn over 6G under sykemelding (arbeidsgiverens del gir feriepenger, Nav gir feriepenger de første 48 dagene)
                                </span>
                              </label>
                              
                              {daysTakenByType.sykemelding > 48 && (
                                <label className="flex items-start space-x-3 cursor-pointer">
                                  <div className="custom-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={employerPaysVacationOnNavSick}
                                      onChange={(e) => setEmployerPaysVacationOnNavSick(e.target.checked)}
                                      className="sr-only"
                                    />
                                    <div className={`w-4 h-4 border-2 rounded transition-colors ${employerPaysVacationOnNavSick ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                      {employerPaysVacationOnNavSick && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-sm">
                                    Arbeidsgiveren min betaler feriepenger på Navs del etter 48 dager sykemelding totalt per år (utover vanlig Nav-regel)
                                  </span>
                                </label>
                              )}
                            </div>
                          )}
                          
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
                // Reset global form fields to defaults
                setYearlyIncomeDisplay('');
                setVacationPay(12);
                setVacationPayDisplay('12');
                setHoursPerDay(7.5);
                setHoursPerDayDisplay('7,5');
                setEmployerCoversAbove6G(false);
                setEmployerCoversSykeAbove6G(false);
                setEmployerPaysVacationOnNavSick(false);

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
            Feriepengekalkulatoren &nbsp;&nbsp;·&nbsp;&nbsp; laga med kjærleik og claude code
          </p>
        </footer>
      </div>
    </div>
  );
}
