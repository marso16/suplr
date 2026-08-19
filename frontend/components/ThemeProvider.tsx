"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface ThemeCtx {
  isDark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    // Read directly from DOM to avoid stale closure
    const currentlyDark = document.documentElement.classList.contains("dark");
    const next = !currentlyDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return <Ctx.Provider value={{ isDark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
