import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T | (() => T), year?: number): [T, (value: T) => void] {
  const storageKey = year ? `${key}_${year}` : key;
  
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }
    
    try {
      const item = window.localStorage.getItem(storageKey);
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
    }
    
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    
    if (typeof window === 'undefined') return;
    
    // For year-dependent keys, handle year changes
    if (year !== undefined) {
      try {
        const item = window.localStorage.getItem(storageKey);
        if (item) {
          const parsedValue = JSON.parse(item);
          setStoredValue(parsedValue);
        } else {
          // Reset to initial value when switching to a year with no data
          const resetValue = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
          setStoredValue(resetValue);
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${storageKey}":`, error);
      }
    }
  }, [storageKey, year, initialValue]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined' && isHydrated) {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${storageKey}":`, error);
    }
  };

  return [storedValue, setValue];
}

export function clearAllLocalStorage() {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('yearlyIncome_') || key.startsWith('vacationPay_') || key.startsWith('hoursPerDay_') || key.startsWith('dayStates_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}