import type { ReactNode } from "react";

type DetailDrawerProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function DetailDrawer(props: DetailDrawerProps) {
  return (
    <aside className="detail-drawer">
      <div className="detail-drawer-head">
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h3>{props.title}</h3>
        {props.description ? <p>{props.description}</p> : null}
      </div>
      <div className="detail-drawer-body">{props.children}</div>
    </aside>
  );
}
