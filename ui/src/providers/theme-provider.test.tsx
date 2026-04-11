import { expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <span>{theme}</span>
      <button onClick={toggleTheme} type="button">
        toggle
      </button>
    </div>
  );
}

test("theme provider toggles and persists the selected theme", () => {
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );

  expect(screen.getByText("light")).toBeInTheDocument();
  fireEvent.click(screen.getByText("toggle"));
  expect(screen.getByText("dark")).toBeInTheDocument();
  expect(window.localStorage.getItem("core-gateway-theme")).toBe("dark");
});
