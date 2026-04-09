import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { VIEW_META } from "../lib/content";
import { formatDateTime, formatStatus, getStatusTone } from "../lib/format";
import type { TaskItem } from "../types";

type BatchRegisterPageProps = {
  tasks: TaskItem[];
  selectedTaskId: number | null;
  registerConfig: {
    batchSize: number;
    concurrentWorkers: number;
    maxRetries: number;
    fetchToken: boolean;
    headless: boolean;
  };
  busy: boolean;
  onSelectTask: (taskId: number | null) => void;
  onConfigChange: (patch: Partial<BatchRegisterPageProps["registerConfig"]>) => void;
  onRunRegister: () => void;
  onRefresh: () => void;
};

export function BatchRegisterPage(props: BatchRegisterPageProps) {
  const meta = VIEW_META.register;
  const selectedTask = props.tasks.find((task) => task.id === props.selectedTaskId) ?? props.tasks[0] ?? null;
  const runningCount = props.tasks.filter((task) => task.status === "running" || task.status === "pending").length;
  const completedCount = props.tasks.filter((task) => task.status === "completed").length;
  const failureCount = props.tasks.reduce((sum, task) => sum + task.failure_count, 0);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={props.onRefresh} disabled={props.busy}>
              刷新批次
            </button>
            <button className="primary-button" type="button" onClick={props.onRunRegister} disabled={props.busy}>
              启动注册任务
            </button>
          </div>
        }
      />

      <section className="stat-grid stat-grid-three">
        <StatCard label="累计批次" value={props.tasks.length} hint="已经创建过的注册任务批次数量" />
        <StatCard label="进行中批次" value={runningCount} hint="仍在执行或等待执行的任务" tone="warning" />
        <StatCard label="累计失败数" value={failureCount} hint="全部批次中的失败条目总和" tone={failureCount > 0 ? "danger" : "default"} />
      </section>

      <section className="panel-grid panel-grid-two register-layout">
        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Configure</p>
              <h3>注册参数</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>单批数量</span>
              <input type="number" min={1} value={props.registerConfig.batchSize} onChange={(event) => props.onConfigChange({ batchSize: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>并发数</span>
              <input
                type="number"
                min={1}
                value={props.registerConfig.concurrentWorkers}
                onChange={(event) => props.onConfigChange({ concurrentWorkers: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>失败重试</span>
              <input type="number" min={0} value={props.registerConfig.maxRetries} onChange={(event) => props.onConfigChange({ maxRetries: Number(event.target.value) })} />
            </label>
            <label className="switch-field">
              <div>
                <strong>注册后拉取 Token</strong>
                <p>注册完成后立即尝试补齐后续流程所需凭证。</p>
              </div>
              <input type="checkbox" checked={props.registerConfig.fetchToken} onChange={(event) => props.onConfigChange({ fetchToken: event.target.checked })} />
            </label>
            <label className="switch-field field-span-2">
              <div>
                <strong>无头模式</strong>
                <p>适合后台运行；调试排障时可以关闭，直接观察浏览器行为。</p>
              </div>
              <input type="checkbox" checked={props.registerConfig.headless} onChange={(event) => props.onConfigChange({ headless: event.target.checked })} />
            </label>
          </div>
          <div className="callout">
            <strong>建议节奏</strong>
            <p>先用较小批量验证流程通畅，再逐步提高并发和批次数，避免一次性堆积太多失败日志。</p>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div className="panel-head-copy">
              <p className="eyebrow">Batches</p>
              <h3>最近批次</h3>
            </div>
            <span className="subtle-chip">已完成 {completedCount} 个</span>
          </div>
          {props.tasks.length > 0 ? (
            <div className="task-list">
              {props.tasks.map((task) => (
                <button
                  key={task.id ?? `${task.task_type}-${task.started_at}`}
                  type="button"
                  className={selectedTask?.id === task.id ? "task-item active" : "task-item"}
                  onClick={() => props.onSelectTask(task.id)}
                >
                  <div className="task-item-top">
                    <strong>批次 #{task.id ?? "-"}</strong>
                    <span className={`badge tone-${getStatusTone(task.status)}`}>{formatStatus(task.status)}</span>
                  </div>
                  <div className="task-item-meta">
                    <span>成功 {task.success_count}</span>
                    <span>失败 {task.failure_count}</span>
                    <span>{formatDateTime(task.finished_at ?? task.started_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="还没有批次记录" description="先确认参数，再启动第一批注册任务，这里会逐步沉淀你的批次历史和执行表现。" />
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-head-copy">
            <p className="eyebrow">Detail</p>
            <h3>批次详情</h3>
          </div>
        </div>
        {selectedTask ? (
          <div className="panel-grid panel-grid-two">
            <div className="detail-list">
              <div className="detail-row">
                <span>状态</span>
                <span className={`badge tone-${getStatusTone(selectedTask.status)}`}>{formatStatus(selectedTask.status)}</span>
              </div>
              <div className="detail-row">
                <span>开始时间</span>
                <strong>{formatDateTime(selectedTask.started_at)}</strong>
              </div>
              <div className="detail-row">
                <span>结束时间</span>
                <strong>{formatDateTime(selectedTask.finished_at)}</strong>
              </div>
              <div className="detail-row">
                <span>成功 / 失败</span>
                <strong>
                  {selectedTask.success_count} / {selectedTask.failure_count}
                </strong>
              </div>
              {selectedTask.latest_error ? (
                <div className="callout callout-danger">
                  <strong>最近错误</strong>
                  <p>{selectedTask.latest_error}</p>
                </div>
              ) : null}
              <details className="details-block">
                <summary>查看配置快照</summary>
                <div className="details-content">
                  <pre className="code-block">{JSON.stringify(selectedTask.config_snapshot, null, 2)}</pre>
                </div>
              </details>
            </div>

            <div className="detail-list">
              <div className="panel-header compact">
                <div className="panel-head-copy">
                  <h3>最近日志</h3>
                </div>
              </div>
              <div className="log-list">
                {selectedTask.recent_logs.length > 0 ? (
                  selectedTask.recent_logs.map((log) => (
                    <div className="log-item" key={log.id ?? `${log.created_at}-${log.message}`}>
                      <div className="log-item-top">
                        <strong>{log.level}</strong>
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                      <p>{log.message}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="还没有日志" description="当前批次暂无可展示的最近日志，稍后刷新即可看到新的执行明细。" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="尚未选中批次" description="从左侧列表选择一个批次后，这里会展示完整的执行结果、参数快照和最近日志。" />
        )}
      </section>
    </section>
  );
}
