import { useState, useEffect } from "react";

export const useTheme = () => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("btc-theme");
      if (stored === "dark" || stored === "light" || stored === "system") return stored;
      return "system";
    }
    return "system";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;

    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme;
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
    };

    applyTheme();

    if (theme === "system") {
      const handleSystemThemeChange = () => applyTheme();
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }

    return;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("btc-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : t === "dark" ? "system" : "light"));

  return { theme, toggleTheme };
};
