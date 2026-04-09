import { MetricCard } from "../components/MetricCard";
import { PageTitle } from "../components/PageTitle";
import { formatDateTime, formatStatus, formatTaskType } from "../lib/format";
import type { AppSnapshot } from "../types";

export function DashboardPage(props: {
  snapshot: AppSnapshot;
  onRefresh: () => void;
  onOpenTask: (taskId: number | null) => void;
}) {
  const latestTask = props.snapshot.latest_task_summary;

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Overview"
        title="仪表盘"
        description="聚合显示账号库、任务执行和代理状态，让你先判断现在该处理什么。"
        actions={
          <button className="ghost-button" onClick={props.onRefresh}>
            立即刷新
          </button>
        }
      />

      <section className="summary-grid">
        <MetricCard label="账号总数" value={props.snapshot.summary.account_count} hint="已纳入账号库" />
        <MetricCard label="代理数量" value={props.snapshot.summary.proxy_count} hint="当前代理池可见记录" />
        <MetricCard label="任务总数" value={props.snapshot.summary.task_count} hint="按任务批次统计" />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Latest Task</p>
              <h3>最近任务</h3>
            </div>
            {latestTask ? (
              <button className="ghost-button" onClick={() => props.onOpenTask(latestTask.id)}>
                查看详情
              </button>
            ) : null}
          </div>

          {latestTask ? (
            <div className="latest-task-card">
              <div className="status-chip">{formatStatus(latestTask.status)}</div>
              <h4>{formatTaskType(latestTask.task_type)}</h4>
              <p>完成时间 {formatDateTime(latestTask.finished_at)}</p>
              <div className="task-meta-row">
                <span>成功 {latestTask.success_count}</span>
                <span>失败 {latestTask.failure_count}</span>
              </div>
              {latestTask.latest_error ? <div className="inline-alert">{latestTask.latest_error}</div> : null}
            </div>
          ) : (
            <div className="empty-state">当前还没有任务记录。</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Attention</p>
              <h3>关键异常</h3>
            </div>
          </div>
          <div className="alert-list">
            {props.snapshot.alerts.length ? (
              props.snapshot.alerts.map((alert, index) => (
                <button
                  type="button"
                  key={`${alert.title}-${index}`}
                  className="alert-card"
                  onClick={() => props.onOpenTask(alert.task_id ?? null)}
                >
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </button>
              ))
            ) : (
              <div className="empty-state">最近没有高优先级异常。</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

