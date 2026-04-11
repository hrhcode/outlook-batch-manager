import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";

import { MailPreview } from "./mail-preview";

test("mail preview strips unsafe html before rendering", () => {
  render(
    <MailPreview
      message={{
        id: 1,
        account_id: 1,
        subject: "Subject",
        sender: "sender@example.com",
        snippet: "snippet",
        received_at: null,
        synced_at: new Date().toISOString(),
        body_text: null,
        body_html: '<img src="x" onerror="alert(1)" /><p>Hello</p>',
        recipients: "user@example.com"
      }}
    />
  );

  expect(screen.getByText("Hello")).toBeInTheDocument();
  expect(document.querySelector("img")?.getAttribute("onerror")).toBeNull();
});
