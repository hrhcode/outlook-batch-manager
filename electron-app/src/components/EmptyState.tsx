import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className="empty-state-card">
      <strong>{props.title}</strong>
      <p>{props.description}</p>
      {props.action ? <div className="empty-state-action">{props.action}</div> : null}
    </div>
  );
}
