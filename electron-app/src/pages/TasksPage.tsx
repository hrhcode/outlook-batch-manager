import { PageTitle } from "../components/PageTitle";
import { formatDateTime, formatStatus, formatTaskType } from "../lib/format";
import type { RunTaskPayload, TaskItem } from "../types";

export function TasksPage(props: {
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
  onRefresh: () => void;
  onSelectTask: (taskId: number | null) => void;
  onConfigChange: (patch: Partial<{ batchSize: number; concurrentWorkers: number; maxRetries: number; fetchToken: boolean; headless: boolean }>) => void;
  onRunTask: (payload: RunTaskPayload, successText: string) => void;
}) {
  const selectedTask =
    props.tasks.find((task) => task.id === props.selectedTaskId) ??
    props.tasks[0] ??
    null;

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Tasks"
        title="任务中心"
        description="按批次管理注册、登录校验与 Token 刷新任务，并在右侧查看执行细节。"
        actions={
          <button className="ghost-button" onClick={props.onRefresh} disabled={props.busy}>
            刷新任务
          </button>
        }
      />

      <section className="task-workbench">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Run Task</p>
              <h3>发起任务</h3>
            </div>
          </div>

          <div className="button-cluster">
            <button
              className="solid-button"
              disabled={props.busy}
              onClick={() =>
                props.onRunTask(
                  {
                    taskType: "register",
                    batchSize: props.registerConfig.batchSize,
                    concurrentWorkers: props.registerConfig.concurrentWorkers,
                    maxRetries: props.registerConfig.maxRetries,
                    fetchToken: props.registerConfig.fetchToken,
                    headless: props.registerConfig.headless,
                  },
                  "批量注册任务已提交",
                )
              }
            >
              启动批量注册
            </button>
            <button
              className="ghost-button"
              disabled={props.busy}
              onClick={() => props.onRunTask({ taskType: "login_check" }, "登录校验任务已提交")}
            >
              登录校验
            </button>
            <button
              className="ghost-button"
              disabled={props.busy}
              onClick={() => props.onRunTask({ taskType: "token_refresh" }, "Token 刷新任务已提交")}
            >
              Token 刷新
            </button>
          </div>

          <div className="form-grid">
            <FieldNumber label="批量数量" value={props.registerConfig.batchSize} onChange={(value) => props.onConfigChange({ batchSize: value })} />
            <FieldNumber label="并发数量" value={props.registerConfig.concurrentWorkers} onChange={(value) => props.onConfigChange({ concurrentWorkers: value })} />
            <FieldNumber label="重试次数" value={props.registerConfig.maxRetries} onChange={(value) => props.onConfigChange({ maxRetries: value })} />
          </div>

          <div className="switch-row">
            <Toggle label="注册后获取 Token" checked={props.registerConfig.fetchToken} onChange={(checked) => props.onConfigChange({ fetchToken: checked })} />
            <Toggle label="无头模式" checked={props.registerConfig.headless} onChange={(checked) => props.onConfigChange({ headless: checked })} />
          </div>
        </article>

        <div className="task-layout">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Batches</p>
                <h3>任务批次</h3>
              </div>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>成功</th>
                    <th>失败</th>
                    <th>开始时间</th>
                  </tr>
                </thead>
                <tbody>
                  {props.tasks.length ? (
                    props.tasks.map((task) => (
                      <tr
                        key={task.id ?? `${task.task_type}-${task.started_at}`}
                        className={task.id === selectedTask?.id ? "row-active" : ""}
                        onClick={() => props.onSelectTask(task.id)}
                      >
                        <td>{task.id}</td>
                        <td>{formatTaskType(task.task_type)}</td>
                        <td>{formatStatus(task.status)}</td>
                        <td>{task.success_count}</td>
                        <td>{task.failure_count}</td>
                        <td>{formatDateTime(task.started_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">当前还没有任务批次。</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel task-drawer">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Details</p>
                <h3>任务详情</h3>
              </div>
            </div>

            {selectedTask ? (
              <div className="drawer-content">
                <div className="status-chip">{formatStatus(selectedTask.status)}</div>
                <h4>{formatTaskType(selectedTask.task_type)}</h4>
                <div className="task-meta-grid">
                  <span>开始时间 {formatDateTime(selectedTask.started_at)}</span>
                  <span>结束时间 {formatDateTime(selectedTask.finished_at)}</span>
                  <span>成功 {selectedTask.success_count}</span>
                  <span>失败 {selectedTask.failure_count}</span>
                </div>
                {selectedTask.latest_error ? <div className="inline-alert">{selectedTask.latest_error}</div> : null}

                <section className="drawer-section">
                  <h5>配置快照</h5>
                  <pre className="code-block">{JSON.stringify(selectedTask.config_snapshot, null, 2)}</pre>
                </section>

                <section className="drawer-section">
                  <h5>最近日志</h5>
                  <div className="log-list">
                    {selectedTask.recent_logs.length ? (
                      selectedTask.recent_logs.map((log) => (
                        <div className="log-item" key={log.id ?? `${log.created_at}-${log.message}`}>
                          <span>{log.level}</span>
                          <p>{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">当前任务还没有日志。</div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="empty-state">从左侧任务批次列表中选择一条任务查看详情。</div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

function FieldNumber(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <input type="number" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    </label>
  );
}

