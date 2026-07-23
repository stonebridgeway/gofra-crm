import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = Exclude<ThemeMode, "system">;

const THEME_STORAGE_KEY = "gofra-crm:theme:v1";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const getInitialMode = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
};

const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === "system" ? getSystemTheme() : mode;

const applyTheme = (theme: ResolvedTheme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  themeColor?.setAttribute("content", theme === "dark" ? "#0f0f0c" : "#ede7dc");
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialMode()),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const next = resolveTheme(mode);
      setResolvedTheme(next);
      applyTheme(next);
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The chosen theme still applies for the current session.
    }
    setModeState(next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      toggle: () => setMode(resolvedTheme === "dark" ? "light" : "dark"),
    }),
    [mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}

export function ThemeSwitch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { mode, resolvedTheme, setMode, toggle } = useTheme();

  if (compact) {
    return (
      <button
        aria-label={
          resolvedTheme === "dark"
            ? "Включить светлую тему"
            : "Включить тёмную тему"
        }
        className="theme-toggle-button"
        onClick={toggle}
        title={
          resolvedTheme === "dark"
            ? "Включить светлую тему"
            : "Включить тёмную тему"
        }
        type="button"
      >
        <span aria-hidden="true">{resolvedTheme === "dark" ? "СВ" : "ТМ"}</span>
      </button>
    );
  }

  return (
    <div aria-label="Тема интерфейса" className="theme-switch" role="group">
      {(
        [
          ["system", "Система"],
          ["light", "Светлая"],
          ["dark", "Тёмная"],
        ] as const
      ).map(([value, label]) => (
        <button
          aria-pressed={mode === value}
          className={mode === value ? "is-active" : ""}
          key={value}
          onClick={() => setMode(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
