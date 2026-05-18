import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPreferences } from "./storage";
import { onThemeChange } from "./eventBus";

export interface AppThemeColors {
  primary: string;
  secondary: string;
  profileTheme: string;
}

export const THEME_APP_COLORS: Record<string, AppThemeColors> = {
  rose:    { primary: "#FF7A8A", secondary: "#B9A7FF", profileTheme: "rose" },
  ocean:   { primary: "#3B82F6", secondary: "#60A5FA", profileTheme: "ocean" },
  candy:   { primary: "#C77DFF", secondary: "#F0ABFC", profileTheme: "candy" },
  ember:   { primary: "#F97316", secondary: "#FDBA74", profileTheme: "ember" },
  forest:  { primary: "#22C55E", secondary: "#86EFAC", profileTheme: "forest" },
  night:   { primary: "#818CF8", secondary: "#A5B4FC", profileTheme: "night" },
};

const DEFAULT_COLORS: AppThemeColors = { ...THEME_APP_COLORS.rose };

const ThemeContext = createContext<AppThemeColors>(DEFAULT_COLORS);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<AppThemeColors>(DEFAULT_COLORS);

  const loadTheme = useCallback(async () => {
    const prefs = await getPreferences();
    const id = prefs.profileTheme ?? "rose";
    setColors(THEME_APP_COLORS[id] ?? DEFAULT_COLORS);
  }, []);

  useEffect(() => {
    void loadTheme();
    return onThemeChange(() => void loadTheme());
  }, [loadTheme]);

  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppThemeColors {
  return useContext(ThemeContext);
}
