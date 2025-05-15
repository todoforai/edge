import { useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useCachedState');

/**
 * A hook that works like useState but persists the value to localStorage
 * @param initialValue The initial state value
 * @param storageKey The localStorage key to use for persistence
 * @param debounceMs Debounce time in milliseconds for writing to localStorage
 * @returns A stateful value and a function to update it, just like useState
 */
export function useCachedState<T>(
  initialValue: T,
  storageKey: string,
  debounceMs: number = 500
): [T, (value: T | ((prevValue: T) => T)) => void] {
  // Initialize state from localStorage or use initialValue
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error(`Error reading from localStorage: ${error}`);
      return initialValue;
    }
  });

  // Create debounced localStorage setter
  const debouncedSave = useCallback(
    debounce((value: T) => {
      try {
        if (value === undefined || value === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      } catch (error) {
        logger.error(`Error saving to localStorage: ${error}`);
      }
    }, debounceMs),
    [storageKey, debounceMs]
  );

  // Update localStorage when state changes
  const setStateAndCache = useCallback((value: T | ((prevValue: T) => T)) => {
    if (typeof value === 'function') {
      setState(prevState => {
        const newState = (value as (prevValue: T) => T)(prevState);
        debouncedSave(newState);
        return newState;
      });
    } else {
      debouncedSave(value);
      setState(value);
    }
  }, [debouncedSave]);

  return [state, setStateAndCache];
}