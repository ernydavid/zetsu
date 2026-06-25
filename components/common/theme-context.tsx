"use client";

import * as React from "react";

export type AccentTheme = "slate" | "lavender" | "mint" | "sky" | "peach";

interface AccentThemeContextProps {
  accentTheme: AccentTheme;
  setAccentTheme: (theme: AccentTheme) => void;
}

const AccentThemeContext = React.createContext<AccentThemeContextProps | undefined>(
  undefined
);

export function AccentThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accentTheme, setAccentThemeState] = React.useState<AccentTheme>("slate");

  // Load theme on mount
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("zetsu-accent-theme") as AccentTheme;
    if (savedTheme && ["slate", "lavender", "mint", "sky", "peach"].includes(savedTheme)) {
      setAccentThemeState(savedTheme);
      applyThemeClass(savedTheme);
    } else {
      applyThemeClass("slate");
    }
  }, []);

  const applyThemeClass = (theme: AccentTheme) => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      // Remove all possible accent classes
      root.classList.remove(
        "accent-slate",
        "accent-lavender",
        "accent-mint",
        "accent-sky",
        "accent-peach"
      );
      // Add the new one
      root.classList.add(`accent-${theme}`);
    }
  };

  const setAccentTheme = (theme: AccentTheme) => {
    setAccentThemeState(theme);
    localStorage.setItem("zetsu-accent-theme", theme);
    applyThemeClass(theme);
  };

  return (
    <AccentThemeContext.Provider value={{ accentTheme, setAccentTheme }}>
      {children}
    </AccentThemeContext.Provider>
  );
}

export function useAccentTheme() {
  const context = React.useContext(AccentThemeContext);
  if (context === undefined) {
    throw new Error("useAccentTheme must be used within an AccentThemeProvider");
  }
  return context;
}
