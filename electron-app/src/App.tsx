import { FormEvent, useEffect, useState } from "react";
import type { AppSettings, AppSnapshot, RunTaskPayload, TaskItem } from "./types";

const emptySettings: AppSettings = {
  browser_channel: "chromium",
  browser_executable_path: "",
  headless: false,
  timeout_ms: 30000,
  captcha_wait_ms: 12000,
  user_agent: "",
  use_mock_driver: true,
  client_id: "",
  redirect_url: "",
  scopes: [],
};

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [meta, setMeta] = useState<{ projectRoot: string; pythonExecutable: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(emptySettings);
  const [registerConfig, setRegisterConfig] = useState({
    batchSize: 5,
    concurrentWorkers: 2,
    maxRetries: 1,
    fetchToken: true,
    headless: false,
  });

  async function loadSnapshot() {
    try {
      const [nextSnapshot, nextMeta] = await Promise.all([
        window.desktopApi.getSnapshot(),
        window.desktopApi.getMeta(),
      ]);
      setSnapshot(nextSnapshot);
      setSettingsDraft(nextSnapshot.settings);
      setMeta(nextMeta);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  async function runTask(payload: RunTaskPayload, successText: string) {
    setBusy(true);
    setNotice("");
    try {
      await window.desktopApi.runTask(payload);
      await loadSnapshot();
      setNotice(successText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "任务执行失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await window.desktopApi.saveSettings(settingsDraft);
      await loadSnapshot();
      setNotice("设置已保存");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存设置失败");
    } finally {
      setBusy(false);
    }
  }

  const filteredAccounts = snapshot?.accounts.filter((account) => {
    if (!query.trim()) return true;
    const term = query.toLowerCase();
    return [account.email, account.group_name, account.notes, account.status].join(" ").toLowerCase().includes(term);
  }) ?? [];

  const currentTask: TaskItem | undefined = snapshot?.tasks[0];

  if (loading) {
    return <div className="shell loading">Loading workspace...</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <p className="eyebrow">Electron Shell</p>
            <h1>Outlook Batch Manager</h1>
          </div>
        </div>

        <div className="meta-card">
          <p>项目目录</p>
          <strong>{meta?.projectRoot}</strong>
        </div>
        <div className="meta-card">
          <p>Python 环境</p>
          <strong>{meta?.pythonExecutable}</strong>
        </div>
        <div className="meta-card">
          <p>刷新时间</p>
          <strong>{snapshot?.generated_at ?? "-"}</strong>
        </div>
      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Minimal black / white workspace</p>
            <h2>清晰、优雅、可直接操作真实数据的桌面前端壳</h2>
          </div>
          <button className="ghost-button" onClick={() => void loadSnapshot()} disabled={busy}>
            刷新视图
          </button>
        </section>

        <section className="summary-grid">
          <MetricCard label="账号总数" value={snapshot?.summary.account_count ?? 0} />
          <MetricCard label="代理池" value={snapshot?.summary.proxy_count ?? 0} />
          <MetricCard label="任务数" value={snapshot?.summary.task_count ?? 0} />
        </section>

        {(error || notice) && (
          <section className="status-row">
            {error ? <div className="status-pill error">{error}</div> : null}
            {notice ? <div className="status-pill success">{notice}</div> : null}
          </section>
        )}

        <section className="workspace-grid">
          <article className="panel task-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Task Console</p>
                <h3>任务中心</h3>
              </div>
            </header>

            <div className="button-cluster">
              <button
                className="solid-button"
                disabled={busy}
                onClick={() =>
                  void runTask(
                    {
                      taskType: "register",
                      batchSize: registerConfig.batchSize,
                      concurrentWorkers: registerConfig.concurrentWorkers,
                      maxRetries: registerConfig.maxRetries,
                      fetchToken: registerConfig.fetchToken,
                      headless: registerConfig.headless,
                    },
                    "批量注册任务已提交",
                  )
                }
              >
                启动批量注册
              </button>
              <button className="ghost-button" disabled={busy} onClick={() => void runTask({ taskType: "login_check" }, "登录校验任务已提交")}>
                登录校验
              </button>
              <button className="ghost-button" disabled={busy} onClick={() => void runTask({ taskType: "token_refresh" }, "Token 刷新任务已提交")}>
                Token 刷新
              </button>
            </div>

            <div className="config-grid">
              <FieldNumber label="批量数量" value={registerConfig.batchSize} onChange={(value) => setRegisterConfig({ ...registerConfig, batchSize: value })} />
              <FieldNumber label="并发数" value={registerConfig.concurrentWorkers} onChange={(value) => setRegisterConfig({ ...registerConfig, concurrentWorkers: value })} />
              <FieldNumber label="重试次数" value={registerConfig.maxRetries} onChange={(value) => setRegisterConfig({ ...registerConfig, maxRetries: value })} />
            </div>

            <div className="switch-row">
              <Toggle label="注册后获取 Token" checked={registerConfig.fetchToken} onChange={(checked) => setRegisterConfig({ ...registerConfig, fetchToken: checked })} />
              <Toggle label="无头模式" checked={registerConfig.headless} onChange={(checked) => setRegisterConfig({ ...registerConfig, headless: checked })} />
            </div>

            <div className="task-log">
              <div className="task-log-header">
                <span>最近任务</span>
                <strong>{currentTask ? `#${currentTask.id} · ${currentTask.task_type}` : "暂无任务"}</strong>
              </div>
              {currentTask ? (
                <>
                  <div className="task-stats">
                    <span>状态 {currentTask.status}</span>
                    <span>成功 {currentTask.success_count}</span>
                    <span>失败 {currentTask.failure_count}</span>
                  </div>
                  <div className="log-list">
                    {currentTask.recent_logs.length ? (
                      currentTask.recent_logs.map((log) => (
                        <div className="log-item" key={log.id ?? `${log.created_at}-${log.message}`}>
                          <span>{log.level}</span>
                          <p>{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">当前任务还没有日志。</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">任务执行后，这里会显示最新进度和日志。</div>
              )}
            </div>
          </article>

          <article className="panel accounts-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Accounts</p>
                <h3>账号库</h3>
              </div>
              <input className="search-input" placeholder="搜索邮箱 / 分组 / 状态" value={query} onChange={(event) => setQuery(event.target.value)} />
            </header>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>邮箱</th>
                    <th>状态</th>
                    <th>Token</th>
                    <th>分组</th>
                    <th>来源</th>
                    <th>校验时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length ? (
                    filteredAccounts.map((account) => (
                      <tr key={account.id ?? account.email}>
                        <td>
                          <div className="primary-cell">
                            <strong>{account.email}</strong>
                            <span>{account.password}</span>
                          </div>
                        </td>
                        <td>{account.status}</td>
                        <td>{account.token_status || "未获取"}</td>
                        <td>{account.group_name}</td>
                        <td>{account.source}</td>
                        <td>{account.last_login_check_at ?? "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}><div className="empty-state">没有匹配的账号记录。</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel settings-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Settings</p>
                <h3>系统设置</h3>
              </div>
            </header>

            <form className="settings-form" onSubmit={(event) => void saveSettings(event)}>
              <FieldText label="浏览器路径" value={settingsDraft.browser_executable_path} onChange={(value) => setSettingsDraft({ ...settingsDraft, browser_executable_path: value })} />
              <FieldText label="User-Agent" value={settingsDraft.user_agent} onChange={(value) => setSettingsDraft({ ...settingsDraft, user_agent: value })} />
              <div className="config-grid">
                <FieldNumber label="页面超时" value={settingsDraft.timeout_ms} onChange={(value) => setSettingsDraft({ ...settingsDraft, timeout_ms: value })} />
                <FieldNumber label="验证码等待" value={settingsDraft.captcha_wait_ms} onChange={(value) => setSettingsDraft({ ...settingsDraft, captcha_wait_ms: value })} />
                <div />
              </div>
              <div className="switch-row">
                <Toggle label="模拟驱动" checked={settingsDraft.use_mock_driver} onChange={(checked) => setSettingsDraft({ ...settingsDraft, use_mock_driver: checked })} />
                <Toggle label="无头模式" checked={settingsDraft.headless} onChange={(checked) => setSettingsDraft({ ...settingsDraft, headless: checked })} />
              </div>
              <FieldText label="Client ID" value={settingsDraft.client_id} onChange={(value) => setSettingsDraft({ ...settingsDraft, client_id: value })} />
              <FieldText label="Redirect URL" value={settingsDraft.redirect_url} onChange={(value) => setSettingsDraft({ ...settingsDraft, redirect_url: value })} />
              <label>
                <span>Scopes</span>
                <textarea
                  rows={4}
                  value={settingsDraft.scopes.join("\n")}
                  onChange={(event) => setSettingsDraft({ ...settingsDraft, scopes: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                />
              </label>
              <button className="solid-button" type="submit" disabled={busy}>保存设置</button>
            </form>
          </article>

          <article className="panel proxy-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Proxy Pool</p>
                <h3>代理池</h3>
              </div>
            </header>
            <div className="proxy-list">
              {snapshot?.proxies.length ? (
                snapshot.proxies.map((proxy) => (
                  <div className="proxy-item" key={proxy.id ?? proxy.server}>
                    <strong>{proxy.server}</strong>
                    <span>{proxy.status}</span>
                    <small>{proxy.last_used_at ?? "未使用"}</small>
                  </div>
                ))
              ) : (
                <div className="empty-state">当前还没有代理数据。</div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function MetricCard(props: { label: string; value: number }) {
  return (
    <article className="metric-card">
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </article>
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

function FieldText(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
