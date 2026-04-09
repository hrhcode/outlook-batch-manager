import { PageTitle } from "../components/PageTitle";
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
  const selectedTask = props.tasks.find((task) => task.id === props.selectedTaskId) ?? props.tasks[0] ?? null;

  return (
    <section className="page-stack">
      <PageTitle
        actions={
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={props.onRefresh} disabled={props.busy}>
              刷新
            </button>
            <button className="primary-button" type="button" onClick={props.onRunRegister} disabled={props.busy}>
              启动注册任务
            </button>
          </div>
        }
      />

      <section className="two-column register-layout">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Configure</p>
              <h3>注册参数</h3>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>批量数量</span>
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
            <label className="field toggle-field">
              <span>注册后获取 Token</span>
              <input type="checkbox" checked={props.registerConfig.fetchToken} onChange={(event) => props.onConfigChange({ fetchToken: event.target.checked })} />
            </label>
            <label className="field toggle-field">
              <span>无头模式</span>
              <input type="checkbox" checked={props.registerConfig.headless} onChange={(event) => props.onConfigChange({ headless: event.target.checked })} />
            </label>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Batches</p>
              <h3>最近批次</h3>
            </div>
          </div>
          <div className="task-list">
            {props.tasks.length > 0 ? (
              props.tasks.map((task) => (
                <button
                  key={task.id ?? `${task.task_type}-${task.started_at}`}
                  type="button"
                  className={selectedTask?.id === task.id ? "task-card active" : "task-card"}
                  onClick={() => props.onSelectTask(task.id)}
                >
                  <div className="task-card-row">
                    <strong>批次 #{task.id}</strong>
                    <span className={`status-badge status-${task.status}`}>{task.status}</span>
                  </div>
                  <div className="task-card-row">
                    <span>成功 {task.success_count}</span>
                    <span>失败 {task.failure_count}</span>
                  </div>
                  <p>{task.finished_at ?? task.started_at ?? "等待开始"}</p>
                </button>
              ))
            ) : (
              <div className="empty-state">还没有注册批次，先配置参数再启动任务。</div>
            )}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Detail</p>
            <h3>批次详情</h3>
          </div>
        </div>
        {selectedTask ? (
          <div className="detail-grid">
            <div className="detail-stack">
              <div className="key-value-grid">
                <span>状态</span>
                <strong>{selectedTask.status}</strong>
                <span>成功 / 失败</span>
                <strong>
                  {selectedTask.success_count} / {selectedTask.failure_count}
                </strong>
                <span>开始时间</span>
                <strong>{selectedTask.started_at ?? "-"}</strong>
                <span>结束时间</span>
                <strong>{selectedTask.finished_at ?? "进行中"}</strong>
              </div>
              <div className="detail-block">
                <span className="detail-label">配置快照</span>
                <pre className="code-block">{JSON.stringify(selectedTask.config_snapshot, null, 2)}</pre>
              </div>
            </div>
            <div className="detail-stack">
              <div className="detail-block">
                <span className="detail-label">最近日志</span>
                <div className="log-list">
                  {selectedTask.recent_logs.map((log) => (
                    <div className="log-item" key={log.id ?? `${log.created_at}-${log.message}`}>
                      <div className="log-meta">
                        <strong>{log.level}</strong>
                        <span>{log.created_at}</span>
                      </div>
                      <p>{log.message}</p>
                    </div>
                  ))}
                  {selectedTask.recent_logs.length === 0 ? <div className="empty-state">当前批次还没有日志。</div> : null}
                </div>
              </div>
              {selectedTask.latest_error ? (
                <div className="detail-block">
                  <span className="detail-label">最近错误</span>
                  <p className="inline-error">{selectedTask.latest_error}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state">选择一个批次后，这里会显示更完整的配置和日志。</div>
        )}
      </section>
    </section>
  );
}
