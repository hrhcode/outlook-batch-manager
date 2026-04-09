export function StatusBanner(props: { error: string; notice: string }) {
  if (!props.error && !props.notice) {
    return null;
  }

  return (
    <section className="banner-stack" aria-live="polite">
      {props.error ? (
        <div className="banner-card banner-card-danger">
          <strong>处理失败</strong>
          <p>{props.error}</p>
        </div>
      ) : null}
      {props.notice ? (
        <div className="banner-card banner-card-success">
          <strong>操作完成</strong>
          <p>{props.notice}</p>
        </div>
      ) : null}
    </section>
  );
}
