'use client';

import { useState, useDeferredValue, useMemo, useEffect, useRef, useCallback } from 'react';
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

  // Defer year changes to avoid blocking UI
  const deferredYear = useDeferredValue(displayYear);

  // Ref for dropdown click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track selected days: key is "year-month-day", value is the status
  const [dayStatesObj, setDayStatesObj] = useLocalStorage<Record<string, DayStatus>>('dayStates', {}, displayYear);
  const [isCalendarReady, setIsCalendarReady] = useState(false);

  // Convert to Map for easier usage
  const dayStates = useMemo(() => new Map(Object.entries(dayStatesObj)), [dayStatesObj]);
  const setDayStates = (updateFn: (prev: Map<string, DayStatus>) => Map<string, DayStatus>) => {
    const newMap = updateFn(dayStates);
    const newObj = Object.fromEntries(newMap.entries());
    setDayStatesObj(newObj);
  };

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
    } else if (!isCalendarReady) {
      // Initial render
      const timer = setTimeout(() => setIsCalendarReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [displayYear, calendarKey, isCalendarReady]);

  // Current selection mode for drag operations
  const [selectionMode, setSelectionMode] = useState<DayStatus>('ferie');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragAction, setDragAction] = useState<'add' | 'remove'>('add');
  const [calculationMethod, setCalculationMethod] = useLocalStorage<'standard' | 'generous' | 'stingy' | 'anal'>('calculationMethod', 'standard');

  // Helper to create day key
  const getDayKey = (year: number, month: string, day: number): string => {
    return `${year}-${month}-${day}`;
  };

  // Update day status
  const updateDayStatus = (year: number, month: string, day: number, status: DayStatus) => {
    const key = getDayKey(year, month, day);
    setDayStates(prev => {
      const newMap = new Map(prev);
      if (status === null) {
        newMap.delete(key);
      } else {
        newMap.set(key, status);
      }
      return newMap;
    });
  };

  // Get day status
  const getDayStatus = (year: number, month: string, day: number): DayStatus => {
    const key = getDayKey(year, month, day);
    return dayStates.get(key) || null;
  };

  // Start drag operation
  const startDrag = (action: 'add' | 'remove') => {
    lastProcessedDayRef.current = ''; // Clear last processed day
    setIsDragging(true);
    setDragAction(action);
  };

  // End drag operation
  const endDrag = () => {
    setIsDragging(false);
  };

  // Track last processed day to avoid redundant updates
  const lastProcessedDayRef = useRef<string>('');

  // Handle drag over day (select/deselect day during drag)
  const handleDragOver = (year: number, month: string, day: number) => {
    if (!isDragging) return;
    
    const dayKey = getDayKey(year, month, day);
    
    // Skip if we just processed this day
    if (lastProcessedDayRef.current === dayKey) return;
    lastProcessedDayRef.current = dayKey;
    
    // Check if it's a holiday or weekend - don't process those
    const date: CalendarDate = { year, month, day };
    if (isHolidayChecker(date) || dayOfWeek(date) === 'sat' || dayOfWeek(date) === 'sun') {
      return;
    }
    
    if (dragAction === 'add') {
      updateDayStatus(year, month, day, selectionMode);
    } else {
      updateDayStatus(year, month, day, null);
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


  // Global mouse up handler to end drag anywhere
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

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
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
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

        {/* Calendar Grid with fixed height and smooth transitions */}
        <div 
          className="calendar-container min-h-[1000px] lg:min-h-[800px] xl:min-h-[600px]"
          onMouseMove={(e) => {
            if (isDragging) {
              // Find the day element under the mouse
              const element = document.elementFromPoint(e.clientX, e.clientY);
              if (element && element.closest('.calendar-day')) {
                const dayElement = element.closest('.calendar-day');
                const dayKey = dayElement?.getAttribute('data-day-key');
                if (dayKey) {
                  const [year, month, day] = dayKey.split('-');
                  handleDragOver(parseInt(year), month, parseInt(day));
                }
              }
            }
          }}
        >
          <div className={`
            grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-1
            transition-all duration-300 ease-in-out
            ${isCalendarReady ? 'opacity-100' : 'opacity-0'}
          `}>
            {isHydrated && months.map((month, index) => (
              <Month
                key={`${calendarKey}-${index}`}
                month={month}
                getDayStatus={getDayStatus}
                updateDayStatus={updateDayStatus}
                startDrag={startDrag}
                dragAction={dragAction}
                endDrag={endDrag}
                handleDragOver={handleDragOver}
                selectionMode={selectionMode}
                isHoliday={isHolidayChecker}
              />
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
              {displayHoursPerDay && (
                <span className="font-medium text-opacity-100">
                  {(displayHoursPerDay * 5 * 52).toLocaleString('nb-NO').replace(/\./g, ',')} timer per år
                </span>
              )}
              {!displayHoursPerDay && <span className="text-opacity-50">0 timer per år</span>}
              .
            </p>

            {yearlyIncomeDisplay && displayHoursPerDay && (
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
              I {displayYear} er det faktisk{' '}
              <span className="font-medium text-opacity-100">
                {actualWorkDays.toLocaleString('nb-NO')} arbeidsdager
              </span>
              {displayHoursPerDay && (
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

            {(daysTakenByType.ferie > 0 || daysTakenByType.permisjon_med_lonn > 0 || daysTakenByType.permisjon_uten_lonn > 0) && (
              <div className="mt-4 space-y-2">
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
              </div>
            )}

            {yearlyIncomeDisplay && displayHoursPerDay && displayVacationPay && (
              <div className="mt-6">
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
              </div>
            )}
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
