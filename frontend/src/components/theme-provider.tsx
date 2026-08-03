"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("sentinel-theme", newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("sentinel-theme") as Theme | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    }

    const root = window.document.documentElement;
    const applyTheme = (t: Theme) => {
      const effectiveTheme = t === "system" 
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : t;
      
      root.classList.remove("light", "dark");
      root.classList.add(effectiveTheme);
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
