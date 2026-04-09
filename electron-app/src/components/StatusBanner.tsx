export function StatusBanner(props: { error: string; notice: string }) {
  if (!props.error && !props.notice) {
    return null;
  }

  return (
    <section className="status-row" aria-live="polite">
      {props.error ? <div className="status-pill error">{props.error}</div> : null}
      {props.notice ? <div className="status-pill success">{props.notice}</div> : null}
    </section>
  );
}
