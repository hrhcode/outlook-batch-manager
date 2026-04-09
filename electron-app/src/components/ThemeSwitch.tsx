import type { ThemeMode } from "../types";

type ThemeSwitchProps = {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
};

export function ThemeSwitch(props: ThemeSwitchProps) {
  const nextTheme = props.theme === "dark" ? "light" : "dark";
  const icon = props.theme === "dark" ? "☀" : "☾";
  const label = props.theme === "dark" ? "切换到浅色主题" : "切换到深色主题";

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={() => props.onChange(nextTheme)}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
