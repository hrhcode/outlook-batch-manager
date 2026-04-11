import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AccountFormModal } from "./account-form-modal";

test("account form modal shows validation feedback after blur", () => {
  render(<AccountFormModal onClose={vi.fn()} onSubmit={vi.fn(async () => undefined)} open />);

  fireEvent.blur(screen.getAllByRole("textbox")[0]);
  expect(screen.getByText("请输入邮箱。")).toBeInTheDocument();
});

test("account form modal closes on escape", () => {
  const onClose = vi.fn();
  render(<AccountFormModal onClose={onClose} onSubmit={vi.fn(async () => undefined)} open />);

  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});
