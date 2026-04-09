import type { ThemeMode } from "../types";

type ThemeSwitchProps = {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
};

export function ThemeSwitch(props: ThemeSwitchProps) {
  const nextTheme = props.theme === "dark" ? "light" : "dark";
  const label = props.theme === "dark" ? "切换到浅色主题" : "切换到深色主题";
  const text = props.theme === "dark" ? "外观 · 深色" : "外观 · 浅色";

  return (
    <button type="button" className="secondary-button theme-switch" aria-label={label} title={label} onClick={() => props.onChange(nextTheme)}>
      {text}
    </button>
  );
}
