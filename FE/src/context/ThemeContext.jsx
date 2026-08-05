import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const THEME_STORAGE_KEY = "aiStudyHub.theme";
export const DEFAULT_THEME = "white";

export const THEME_OPTIONS = [
  {
    value: "white",
    label: "Light",
    description: "White and pale-blue surfaces with blue accents and black text.",
  },
];

const ThemeContext = createContext(null);

export function normalizeTheme() {
  return DEFAULT_THEME;
}

function getStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return DEFAULT_THEME;
}

function persistTheme(theme) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function applyTheme() {
  const theme = DEFAULT_THEME;

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.studyTheme = "light";

    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.dataset.studyTheme = "light";
    }
  }

  return theme;
}

const initialTheme = applyTheme(getStoredTheme());

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    const normalizedTheme = applyTheme(theme);
    persistTheme(normalizedTheme);

    if (normalizedTheme !== theme) {
      setThemeState(normalizedTheme);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    const normalizedTheme = applyTheme(nextTheme);
    persistTheme(normalizedTheme);
    setThemeState(normalizedTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      availableThemes: THEME_OPTIONS,
    }),
    [setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
