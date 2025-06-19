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
  const [calculationMethod, setCalculationMethod] = useLocalStorage<'standard' | 'generous' | 'stingy'>('calculationMethod', 'standard');

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

    for (const [key, status] of dayStates) {
      if (status && status in counts) {
        counts[status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [dayStates, isHydrated]);

  // Calculate monetary impact for each type (for future use)
  const monetaryImpact = useMemo(() => {
    if (!yearlyIncomeDisplay || !displayHoursPerDay) {
      return {
        vacationLoss: 0,
        unpaidLeaveLoss: 0,
        paidLeaveImpact: 0
      };
    }

    const yearlySalary = parseFloat(yearlyIncomeDisplay.replace(/\s/g, '')) || 0;
    const totalHoursPerYear = displayHoursPerDay * 5 * 52;
    const nominalHourlyRate = yearlySalary / totalHoursPerYear;

    return {
      // Vacation: lost work time but paid via vacation pay
      vacationLoss: daysTakenByType.ferie * displayHoursPerDay * nominalHourlyRate,
      // Unpaid leave: direct loss of income
      unpaidLeaveLoss: daysTakenByType.permisjon_uten_lonn * displayHoursPerDay * nominalHourlyRate,
      // Paid leave: no direct loss (paid as normal work day)
      paidLeaveImpact: 0
    };
  }, [yearlyIncomeDisplay, displayHoursPerDay, daysTakenByType]);

  // Calculate actual work days in the year (excluding weekends)
  const actualWorkDays = useMemo(() => {
    let workDayCount = 0;

    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(displayYear, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(displayYear, month, day);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

        // Count Monday (1) through Friday (5) as work days
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          workDayCount++;
        }
      }
    }

    return workDayCount;
  }, [displayYear]);


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
                placeholder="7,5"
                className="inline-block bg-transparent border-0 border-b border-solid focus:outline-none text-center mx-1 salary-input"
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
                placeholder="12"
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

        {/* Elegant divider */}
        <div className="mt-8 mb-8 flex justify-center">
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
        </div>

        {/* Calculation section */}
        <div className="grid md:grid-cols-2 gap-8 text-center md:text-left">
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

          <div>
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
                    {(actualWorkDays * displayHoursPerDay).toLocaleString('nb-NO').replace(/\./g, ',')} arbeidstimer
                  </span>
                  {' '}som {(() => {
                    const currentYear = new Date().getFullYear();
                    if (displayYear < currentYear) return 'du jobbet';
                    return 'du kommer til å jobbe';
                  })()}
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
                        , som gir deg en faktisk timelønn på{' '}
                        <span className="font-medium text-opacity-100">
                          {Math.round(actualHourlyRate).toLocaleString('nb-NO')} kroner per time
                        </span>
                        .
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm opacity-70 hover:opacity-100">
                          Endre beregning (avansert)
                        </summary>
                        <div className="mt-4 space-y-3">
                          <div className="space-y-2">
                            <label className="flex items-start space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="calculationMethod"
                                value="standard"
                                checked={calculationMethod === 'standard'}
                                onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy')}
                                className="mt-1"
                              />
                              <span className="text-sm">
                                Arbeidsgiveren min betaler meg 1/12 av lønnen 11 ganger + {displayVacationPay.toString().replace('.', ',')}% feriepenger
                              </span>
                            </label>
                            
                            <label className="flex items-start space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="calculationMethod"
                                value="generous"
                                checked={calculationMethod === 'generous'}
                                onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy')}
                                className="mt-1"
                              />
                              <span className="text-sm">
                                Arbeidsgiveren min er snill og betaler meg 1/11 av lønnen 11 ganger (altså hele den nominelle lønnen) + {displayVacationPay.toString().replace('.', ',')}% feriepenger
                              </span>
                            </label>
                            
                            <label className="flex items-start space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="calculationMethod"
                                value="stingy"
                                checked={calculationMethod === 'stingy'}
                                onChange={(e) => setCalculationMethod(e.target.value as 'standard' | 'generous' | 'stingy')}
                                className="mt-1"
                              />
                              <span className="text-sm">
                                Arbeidsgiveren min er kjip og trekker meg for all ferien jeg tar
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

        <div className="text-center mt-8">
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
