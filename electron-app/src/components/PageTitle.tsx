import type { ReactNode } from "react";

export function PageTitle(props: { eyebrow?: string; title?: string; description?: string; actions?: ReactNode }) {
  if (!props.actions) {
    return null;
  }
  return <header className="page-actions-row">{props.actions}</header>;
}
