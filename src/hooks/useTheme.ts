import { useEffect, useState } from 'react';
import { safeGet, safeSet } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/utils/storageKeys';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
  const saved = (safeGet(STORAGE_KEYS.theme) as 'light' | 'dark' | null) || 'light';
    setTheme(saved);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  safeSet(STORAGE_KEYS.theme, newTheme);
  };

  return { theme, toggleTheme };
}
