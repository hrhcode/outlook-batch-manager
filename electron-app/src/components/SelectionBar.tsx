import type { ReactNode } from "react";

type SelectionBarProps = {
  count: number;
  label: string;
  actions?: ReactNode;
};

export function SelectionBar(props: SelectionBarProps) {
  if (props.count === 0) {
    return null;
  }

  return (
    <section className="selection-bar">
      <div className="selection-bar-copy">
        <strong>已选择 {props.count} 项</strong>
        <span>{props.label}</span>
      </div>
      {props.actions ? <div className="selection-bar-actions">{props.actions}</div> : null}
    </section>
  );
}
