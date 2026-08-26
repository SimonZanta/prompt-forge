type ThemeName = "dark" | "light";

function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Switches the theme and remembers the choice in localStorage (read back by the inline script in <head>). */
export function toggleTheme(): void {
  const nextTheme: ThemeName = currentTheme() === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem("theme", nextTheme); } catch { /* storage may be unavailable */ }
}

export function bindThemeToggle(button: HTMLElement): void {
  button.addEventListener("click", toggleTheme);
}
