export function MetricCard(props: { label: string; value: number; hint?: string }) {
  return (
    <article className="metric-card">
      <p>{props.label}</p>
      <strong>{props.value}</strong>
      {props.hint ? <span>{props.hint}</span> : null}
    </article>
  );
}

