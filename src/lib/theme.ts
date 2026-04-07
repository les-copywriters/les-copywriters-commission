export type Theme = "light" | "dark";

export function getTheme(): Theme {
  return (localStorage.getItem("theme") as Theme) ?? "light";
}

export function applyTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Call once on app boot to restore saved theme preference. */
export function initTheme() {
  applyTheme(getTheme());
}
