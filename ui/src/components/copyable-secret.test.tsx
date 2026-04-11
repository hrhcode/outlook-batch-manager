import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { CopyableSecret } from "./copyable-secret";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

test("copyable secret copies the value and shows copied feedback", async () => {
  render(<CopyableSecret ariaLabel="复制 refresh token" value="secret-token-value" />);

  fireEvent.click(screen.getByRole("button", { name: "复制 refresh token" }));

  await waitFor(() => {
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("secret-token-value");
  });
  expect(screen.getByText("已复制")).toBeInTheDocument();
});
