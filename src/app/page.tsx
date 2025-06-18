'use client';

import { useState, useDeferredValue, useMemo, useEffect, useRef } from 'react';
import { CalendarMonth, monthName } from 'typescript-calendar-date';
import Month from '@/components/Month';
import { useLocalStorage, clearAllLocalStorage } from '@/hooks/useLocalStorage';

export type DayStatus = 'ferie' | 'permisjon_med_lonn' | 'permisjon_uten_lonn' | null;

export default function Home() {
  const [year, setYear] = useLocalStorage<number>('selectedYear', () => new Date().getFullYear());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [yearlyIncomeDisplay, setYearlyIncomeDisplay] = useLocalStorage<string>('yearlyIncome', '');
  const [vacationPay, setVacationPay] = useLocalStorage<number>('vacationPay', 12);
  const [hoursPerDay, setHoursPerDay] = useLocalStorage<number>('hoursPerDay', 7.5);

  // Track hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use current year for server rendering to avoid hydration mismatch
  const displayYear = isHydrated ? year : new Date().getFullYear();
  
  // Defer year changes to avoid blocking UI
  const deferredYear = useDeferredValue(displayYear);

  // Ref for dropdown click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track selected days: key is "year-month-day", value is the status
  const [dayStatesObj, setDayStatesObj] = useLocalStorage<Record<string, DayStatus>>('dayStates', {}, displayYear);
  const [isCalendarReady, setIsCalendarReady] = useState(false);

  // Convert to Map for easier usage
  const dayStates = new Map(Object.entries(dayStatesObj));
  const setDayStates = (updateFn: (prev: Map<string, DayStatus>) => Map<string, DayStatus>) => {
    const newMap = updateFn(dayStates);
    const newObj = Object.fromEntries(newMap.entries());
    setDayStatesObj(newObj);
  };

  // Delay calendar rendering until year data is loaded
  useEffect(() => {
    setIsCalendarReady(false);
    const timer = setTimeout(() => setIsCalendarReady(true), 100);
    return () => clearTimeout(timer);
  }, [displayYear]);

  // Current selection mode for drag operations
  const [selectionMode, setSelectionMode] = useState<DayStatus>('ferie');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragAction, setDragAction] = useState<'add' | 'remove'>('add');

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
    setIsDragging(true);
    setDragAction(action);
  };

  // End drag operation
  const endDrag = () => {
    setIsDragging(false);
  };

  // Handle drag over day (select/deselect day during drag)
  const handleDragOver = (year: number, month: string, day: number) => {
    if (isDragging) {
      if (dragAction === 'add') {
        updateDayStatus(year, month, day, selectionMode);
      } else {
        updateDayStatus(year, month, day, null);
      }
    }
  };

  // Get selection mode display text
  const getSelectionModeText = () => {
    switch (selectionMode) {
      case 'ferie':
        return 'ferie';
      case 'permisjon_med_lonn':
        return 'lønna permisjon';
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

  // Generate all 12 months for the selected year (memoized to avoid recalculation)
  const months: CalendarMonth[] = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      year: deferredYear,
      month: monthName(i + 1)
    })), [deferredYear]);

  // Generate year options (current year ± 3)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
  }, []);


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
            className="text-5xl font-medium mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            Fastlønnskalkulator
          </h1>
        </header>

        <div className="max-w-2xl mx-auto space-y-12">
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
              Jeg har{' '}
              <input
                type="number"
                value={vacationPay || ''}
                onChange={(e) => setVacationPay(Number(e.target.value))}
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
              {' '}% feriepenger.
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify">
            <p style={{ color: 'var(--text-primary)' }}>
              Jeg jobber{' '}
              <input
                type="number"
                value={hoursPerDay || ''}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
              className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
              style={{
                borderBottomColor: 'var(--input-border)',
                color: 'var(--text-primary)',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                width: '50px'
              }}
              placeholder="7.5"
              step="0.1"
              />
              {' '}timer per dag <span className="opacity-50">(for en {isHydrated ? (hoursPerDay || 0) * 5 : ''} timer arbeidsuke)</span>.
            </p>
          </div>

          <div className="text-xl leading-relaxed text-justify" style={{ color: 'var(--text-primary)' }}>
            Jeg vil beregne min totale lønn og timespris for{' '}
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
          </div>
        </div>

        {/* Selection Mode Toggle */}
        <div className="mt-16 mb-8 text-center">
          <div className="text-xl leading-relaxed">
            <p style={{ color: 'var(--text-primary)' }}>
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
              .
            </p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-h-[800px]">
            {isCalendarReady && (
              <div className="contents animate-fadeIn">
                {months.map((month, index) => (
                  <Month
                    key={`${displayYear}-${index}`}
                    month={month}
                    getDayStatus={getDayStatus}
                    updateDayStatus={updateDayStatus}
                    startDrag={startDrag}
                    dragAction={dragAction}
                    endDrag={endDrag}
                    handleDragOver={handleDragOver}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
          <span
            onClick={() => {
              // Reset global form fields
              setYearlyIncomeDisplay('');
              setVacationPay(12);
              setHoursPerDay(7.5);
              
              // Clear current year's day states
              setDayStatesObj({});
            }}
            className="text-sm text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            tilbakestill dette skjemaet
          </span>
        </div>

        <footer className="mt-12 text-center">
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
