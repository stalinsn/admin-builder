'use client';
import { useTheme } from '@/hooks/useTheme';
import { useI18n } from '@/hooks/useI18n';
import { labels } from '@/data/labels';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { lang } = useI18n();

  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={toggleTheme}
        aria-label={labels.toggleTheme[lang as import("@/types/cv").Language]}
      />
      <span className="slider round"></span>
    </label>
  );
}