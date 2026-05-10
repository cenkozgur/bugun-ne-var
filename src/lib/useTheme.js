import { useState, useEffect, useCallback } from 'react';

function getAutoTheme() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  return 'evening';
}

export function useTheme() {
  const [themeOverride, setThemeOverride] = useState(() => {
    return localStorage.getItem('theme-override') || null;
  });
  const [autoTheme, setAutoTheme] = useState(getAutoTheme);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutoTheme(getAutoTheme());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const activeTheme = themeOverride || autoTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-morning', 'theme-day', 'theme-evening');
    root.classList.add(`theme-${activeTheme}`);
  }, [activeTheme]);

  const setOverride = useCallback((theme) => {
    if (theme) {
      localStorage.setItem('theme-override', theme);
      setThemeOverride(theme);
    } else {
      localStorage.removeItem('theme-override');
      setThemeOverride(null);
    }
  }, []);

  return { activeTheme, themeOverride, setOverride, autoTheme };
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return { text: 'günaydın', emoji: '☀️' };
  if (hour >= 11 && hour < 18) return { text: 'DEPLOY-OK-1442', emoji: '👋' };
  return { text: 'iyi akşamlar', emoji: '🌙' };
}