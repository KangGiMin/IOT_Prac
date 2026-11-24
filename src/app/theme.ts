import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'circuit-lab.theme';
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Storage can be unavailable in private browsing or embedded pages. */
export function readThemePreference(browser?: Pick<Window, 'localStorage'>): ThemePreference {
  try {
    const saved = browser?.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(preference: ThemePreference, browser: Pick<Window, 'localStorage'>): void {
  try { browser.localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* Keep the current session usable. */ }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

/** Apply immediately, then follow OS changes only while System is selected. */
export function watchTheme(preference: ThemePreference, root: HTMLElement, media: MediaQueryList): () => void {
  const apply = () => {
    const theme = resolveTheme(preference, media.matches);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  };
  apply();
  if (preference !== 'system') return () => {};
  media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(typeof window === 'undefined' ? undefined : window));

  useEffect(() => watchTheme(preference, document.documentElement, window.matchMedia(SYSTEM_THEME_QUERY)), [preference]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(readThemePreference(window));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return {
    preference,
    setPreference: (next: ThemePreference) => {
      saveThemePreference(next, window);
      setPreference(next);
    },
  };
}
