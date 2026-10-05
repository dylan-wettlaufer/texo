export type Theme = "light" | "dark";

const storageKey = "texo-theme";
const themeEvent = "texo-theme-change";
const systemQuery = "(prefers-color-scheme: dark)";
let sessionTheme: Theme | null = null;

// Runs in the document head so a saved dark theme is applied before first paint.
export const themeInitializationScript = `(() => {
  let theme;
  try { theme = localStorage.getItem(${JSON.stringify(storageKey)}); } catch {}
  const dark = theme === "dark" || (theme !== "light" && matchMedia(${JSON.stringify(systemQuery)}).matches);
  document.documentElement.classList.toggle("dark", dark);
})();`;

function preferredTheme(): Theme {
  if (sessionTheme) return sessionTheme;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Browsers that block storage can still use the toggle for this session.
  }
  return matchMedia(systemQuery).matches ? "dark" : "light";
}

export function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

export function setTheme(theme: Theme) {
  sessionTheme = theme;
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Keep the in-memory preference when storage is unavailable.
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(themeEvent));
}

export function subscribeTheme(onChange: () => void) {
  const system = matchMedia(systemQuery);
  const syncPreference = () => {
    document.documentElement.classList.toggle("dark", preferredTheme() === "dark");
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      sessionTheme = null;
      syncPreference();
    }
  };
  system.addEventListener("change", syncPreference);
  window.addEventListener("storage", onStorage);
  window.addEventListener(themeEvent, onChange);
  syncPreference();
  return () => {
    system.removeEventListener("change", syncPreference);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(themeEvent, onChange);
  };
}
