import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export function StatCard(props: StatCardProps) {
  const toneClass = props.tone && props.tone !== "default" ? ` stat-card-${props.tone}` : "";

  return (
    <div className={`stat-card${toneClass}`}>
      <span className="stat-card-label">{props.label}</span>
      <strong className="stat-card-value">{props.value}</strong>
      {props.hint ? <p className="stat-card-hint">{props.hint}</p> : null}
    </div>
  );
}
