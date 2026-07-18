import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const THEME_STORAGE_KEY = "aiStudyHub.theme";
export const DEFAULT_THEME = "current";

export const THEME_OPTIONS = [
  {
    value: "current",
    label: "Current",
    description: "Warm cream and brown palette currently used across StudyHub.",
  },
  {
    value: "white",
    label: "White",
    description: "Clean bright surfaces, light grays, and high contrast text.",
  },
];

const SUPPORTED_THEMES = new Set(THEME_OPTIONS.map((theme) => theme.value));

const LEGACY_THEME_MAP = {
  warm: "current",
  light: "white",
  dark: "current",
};

const STUDY_THEME_MAP = {
  current: "warm",
  white: "light",
};

const ThemeContext = createContext(null);

export function normalizeTheme(theme) {
  const mappedTheme = LEGACY_THEME_MAP[theme] || theme;
  return SUPPORTED_THEMES.has(mappedTheme) ? mappedTheme : DEFAULT_THEME;
}

function getStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function persistTheme(theme) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function applyTheme(nextTheme) {
  const theme = normalizeTheme(nextTheme);
  const legacyStudyTheme = STUDY_THEME_MAP[theme] || STUDY_THEME_MAP.current;

  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.studyTheme = legacyStudyTheme;

    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.dataset.studyTheme = legacyStudyTheme;
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
