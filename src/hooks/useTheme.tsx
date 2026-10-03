import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'vitalogs.theme';

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

function initial(): boolean {
  try {
    const t = localStorage.getItem(KEY);
    if (t) return t === 'dark';
  } catch {
    /* almacenamiento no disponible */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#061820' : '#EFF7FF');
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', dark ? 'black-translucent' : 'default');
  }, [dark]);

  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem(KEY, d ? 'light' : 'dark');
      } catch {
        /* almacenamiento no disponible */
      }
      return !d;
    });
  }, []);

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
