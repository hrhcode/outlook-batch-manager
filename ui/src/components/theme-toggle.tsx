import { useTheme } from "../providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "light" ? "切换到深色" : "切换到浅色";

  return (
    <button
      aria-label={nextThemeLabel}
      className="theme-toggle"
      onClick={toggleTheme}
      title={nextThemeLabel}
      type="button"
    >
      {theme === "light" ? "深色模式" : "浅色模式"}
    </button>
  );
}
