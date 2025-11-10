import { useCallback, useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const getInitial = () => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : (initialValue instanceof Function ? initialValue() : initialValue);
    } catch {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
  };

  const [value, setValue] = useState<T>(getInitial);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [key]);

  return [value, setValue, remove] as const;
}


