import { useState, useEffect } from 'react';
import type { DayStatus } from '@/app/page';

interface YearData {
  yearlyIncome: string;
  vacationPay: number;
  hoursPerDay: number;
  dayStates: Record<string, DayStatus>;
}

const defaultYearData: YearData = {
  yearlyIncome: '',
  vacationPay: 12,
  hoursPerDay: 7.5,
  dayStates: {}
};

export function useYearStorage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearData, setYearData] = useState<YearData>(defaultYearData);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load selected year from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const storedYear = localStorage.getItem('selectedYear');
      if (storedYear) {
        setSelectedYear(JSON.parse(storedYear));
      }
    } catch (error) {
      console.warn('Error reading selectedYear from localStorage:', error);
    }
  }, []);

  // Load year data when year changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const yearKey = `yearData_${selectedYear}`;
      const storedData = localStorage.getItem(yearKey);
      
      if (storedData) {
        setYearData(JSON.parse(storedData));
      } else {
        setYearData(defaultYearData);
      }
      
      setIsHydrated(true);
    } catch (error) {
      console.warn(`Error reading year data for ${selectedYear}:`, error);
      setYearData(defaultYearData);
      setIsHydrated(true);
    }
  }, [selectedYear]);

  // Save year data to localStorage
  const saveYearData = (newData: Partial<YearData>) => {
    const updatedData = { ...yearData, ...newData };
    setYearData(updatedData);
    
    if (typeof window !== 'undefined' && isHydrated) {
      try {
        const yearKey = `yearData_${selectedYear}`;
        localStorage.setItem(yearKey, JSON.stringify(updatedData));
      } catch (error) {
        console.warn(`Error saving year data for ${selectedYear}:`, error);
      }
    }
  };

  // Save selected year to localStorage
  const updateSelectedYear = (year: number) => {
    setSelectedYear(year);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('selectedYear', JSON.stringify(year));
      } catch (error) {
        console.warn('Error saving selectedYear to localStorage:', error);
      }
    }
  };

  return {
    selectedYear,
    setSelectedYear: updateSelectedYear,
    yearData,
    saveYearData,
    isHydrated
  };
}

export function clearAllYearData() {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key === 'selectedYear' || key.startsWith('yearData_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}