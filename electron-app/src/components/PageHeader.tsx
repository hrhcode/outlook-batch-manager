import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
};

export function PageHeader(props: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      <div className="page-header-side">
        {props.aside ? <div className="page-header-aside">{props.aside}</div> : null}
        {props.actions ? <div className="page-header-actions">{props.actions}</div> : null}
      </div>
    </header>
  );
}
