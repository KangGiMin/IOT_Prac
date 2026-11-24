import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { readThemePreference, resolveTheme, saveThemePreference, SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, watchTheme } from './theme';

function browserWith(value: string | null) {
  return { localStorage: { getItem: vi.fn(() => value), setItem: vi.fn() } } as unknown as Pick<Window, 'localStorage'>;
}

function systemTheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
  };
  return {
    media: media as unknown as MediaQueryList,
    change(next: boolean) { media.matches = next; listeners.forEach(listener => listener()); },
    listeners,
  };
}

function themeRoot() { return { dataset: {}, style: {} } as HTMLElement; }

describe('screen theme preference', () => {
  it('defaults to System and restores only recognized saved preferences', () => {
    expect(readThemePreference()).toBe('system');
    for (const value of [null, '', 'invalid']) expect(readThemePreference(browserWith(value))).toBe('system');
    for (const value of ['light', 'dark', 'system'] as const) expect(readThemePreference(browserWith(value))).toBe(value);
  });

  it('persists all three choices without making blocked storage break the UI', () => {
    const browser = browserWith(null);
    for (const preference of ['light', 'dark', 'system'] as const) {
      saveThemePreference(preference, browser);
      expect(browser.localStorage.setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, preference);
    }
    const blocked = Object.defineProperty({}, 'localStorage', { get() { throw new Error('Storage blocked'); } }) as Window;
    expect(readThemePreference(blocked)).toBe('system');
    expect(() => saveThemePreference('dark', blocked)).not.toThrow();
  });

  it('uses OS appearance only for the System choice', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows live OS changes and removes its listener on cleanup', () => {
    const system = systemTheme(false), root = themeRoot();
    const cleanup = watchTheme('system', root, system.media);
    expect(root.dataset.theme).toBe('light');
    system.change(true);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    system.change(false);
    expect(root.dataset.theme).toBe('light');
    cleanup();
    expect(system.listeners.size).toBe(0);
    system.change(true);
    expect(root.dataset.theme).toBe('light');
  });

  it('switches from System to a fixed theme and can return to System', () => {
    const system = systemTheme(true), root = themeRoot();
    const stopSystem = watchTheme('system', root, system.media);
    stopSystem();
    const stopLight = watchTheme('light', root, system.media);
    expect(root.dataset.theme).toBe('light');
    system.change(false); system.change(true);
    expect(root.dataset.theme).toBe('light');
    expect(system.listeners.size).toBe(0);
    stopLight();
    const stop = watchTheme('system', root, system.media);
    expect(root.dataset.theme).toBe('dark');
    stop();
  });

  it('resolves saved appearance before first paint with the same rules as React', () => {
    const html = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
    const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(bootstrap).toBeTruthy();
    for (const saved of [null, 'light', 'dark', 'system', 'invalid']) {
      for (const dark of [false, true]) {
        const root = themeRoot(), browser = browserWith(saved);
        runInNewContext(bootstrap!, {
          localStorage: browser.localStorage, document: { documentElement: root },
          window: { matchMedia: (query: string) => { expect(query).toBe(SYSTEM_THEME_QUERY); return { matches: dark }; } },
        });
        expect(root.dataset.theme).toBe(resolveTheme(readThemePreference(browser), dark));
      }
    }
  });
});
