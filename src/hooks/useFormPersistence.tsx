'use client';

import { useState, useEffect } from 'react';

export function useFormPersistence<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setValue(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
    setIsLoaded(true);
  }, [key]);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Error saving form data:', error);
      }
    }
  }, [key, value, isLoaded]);

  const clearPersistedData = () => {
    try {
      localStorage.removeItem(key);
      setValue(initialValue);
    } catch (error) {
      console.error('Error clearing form data:', error);
    }
  };

  return [value, setValue, clearPersistedData, isLoaded] as const;
}