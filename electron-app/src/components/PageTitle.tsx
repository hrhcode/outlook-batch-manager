import type { ReactNode } from "react";

export function PageTitle(props: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-title">
      <div>
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h2>{props.title}</h2>
        <p className="page-description">{props.description}</p>
      </div>
      {props.actions ? <div className="page-actions">{props.actions}</div> : null}
    </header>
  );
}
