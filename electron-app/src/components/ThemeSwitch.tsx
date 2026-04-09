import type { ThemeMode } from "../types";

export function ThemeSwitch(props: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  return (
    <div className="theme-switch" role="tablist" aria-label="主题切换">
      <button
        type="button"
        className={props.theme === "dark" ? "theme-button active" : "theme-button"}
        onClick={() => props.onChange("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        className={props.theme === "light" ? "theme-button active" : "theme-button"}
        onClick={() => props.onChange("light")}
      >
        Light
      </button>
    </div>
  );
}
