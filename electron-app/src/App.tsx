import { FormEvent, useEffect, useMemo, useState } from "react";
import { StatusBanner } from "./components/StatusBanner";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { compactPath } from "./lib/format";
import { AccountsPage } from "./pages/AccountsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProxiesPage } from "./pages/ProxiesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import type { AppSettings, AppSnapshot, AppView, RunTaskPayload, ThemeMode } from "./types";

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

const navigation: Array<{ id: AppView; label: string; eyebrow: string }> = [
  { id: "dashboard", label: "仪表盘", eyebrow: "Overview" },
  { id: "tasks", label: "任务中心", eyebrow: "Tasks" },
  { id: "accounts", label: "账号库", eyebrow: "Accounts" },
  { id: "proxies", label: "代理池", eyebrow: "Proxies" },
  { id: "settings", label: "系统设置", eyebrow: "Settings" },
];

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [meta, setMeta] = useState<{ projectRoot: string; pythonExecutable: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(emptySettings);
  const [accountKeyword, setAccountKeyword] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [registerConfig, setRegisterConfig] = useState({
    batchSize: 5,
    concurrentWorkers: 2,
    maxRetries: 1,
    fetchToken: true,
    headless: false,
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("obm-theme");
    const nextTheme: ThemeMode = stored === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("obm-theme", theme);
  }, [theme]);

  async function loadSnapshot() {
    try {
      const [nextSnapshot, nextMeta] = await Promise.all([
        window.desktopApi.getSnapshot(),
        window.desktopApi.getMeta(),
      ]);
      setSnapshot(nextSnapshot);
      setMeta(nextMeta);
      if (activeView !== "settings" || !snapshot) {
        setSettingsDraft(nextSnapshot.settings);
      }
      setError("");
      if (nextSnapshot.tasks.length) {
        const selectedStillExists = nextSnapshot.tasks.some((task) => task.id === selectedTaskId);
        if (selectedTaskId === null || !selectedStillExists) {
          setSelectedTaskId(nextSnapshot.tasks[0].id);
        }
      }
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

  const filteredAccounts = useMemo(() => {
    const allAccounts = snapshot?.accounts ?? [];
    return allAccounts.filter((account) => {
      const keywordMatch = !accountKeyword.trim()
        ? true
        : [account.email, account.group_name, account.notes, account.status]
            .join(" ")
            .toLowerCase()
            .includes(accountKeyword.toLowerCase());
      const statusMatch = accountStatus ? account.status === accountStatus : true;
      return keywordMatch && statusMatch;
    });
  }, [snapshot, accountKeyword, accountStatus]);

  async function runTask(payload: RunTaskPayload, successText: string) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.runTask(payload);
      setSelectedTaskId(result.task_id);
      setActiveView("tasks");
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
    setError("");
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

  async function importAccounts() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.importAccounts();
      if (!("cancelled" in result && result.cancelled)) {
        await loadSnapshot();
        setNotice(`已导入 ${result.imported} 条账号`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function exportAccounts() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.exportAccounts({
        keyword: accountKeyword,
        status: accountStatus,
      });
      if (!("cancelled" in result && result.cancelled)) {
        setNotice(`已导出 ${result.exported} 条账号`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function importProxies() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.importProxies();
      if (!("cancelled" in result && result.cancelled)) {
        await loadSnapshot();
        setNotice(`已导入 ${result.imported} 条代理`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入代理失败");
    } finally {
      setBusy(false);
    }
  }

  function openTask(taskId: number | null) {
    setActiveView("tasks");
    setSelectedTaskId(taskId);
  }

  if (loading || !snapshot) {
    return <div className="shell loading">Loading workspace...</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <p className="eyebrow">Electron Frontend</p>
            <h1>Outlook Batch Manager</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "nav-button active" : "nav-button"}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.eyebrow}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <div className="meta-card">
            <p>项目目录</p>
            <strong title={meta?.projectRoot}>{compactPath(meta?.projectRoot ?? "-")}</strong>
          </div>
          <div className="meta-card">
            <p>Python 环境</p>
            <strong title={meta?.pythonExecutable}>{compactPath(meta?.pythonExecutable ?? "-")}</strong>
          </div>
          <div className="meta-card">
            <p>最近刷新</p>
            <strong>{snapshot.generated_at}</strong>
          </div>
        </div>
      </aside>

      <main className="content">
        <section className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>单一前端工作台</h2>
          </div>
          <div className="topbar-actions">
            <ThemeSwitch theme={theme} onChange={setTheme} />
            <button className="ghost-button" onClick={() => void loadSnapshot()} disabled={busy}>
              刷新视图
            </button>
          </div>
        </section>

        <StatusBanner error={error} notice={notice} />

        {activeView === "dashboard" ? (
          <DashboardPage snapshot={snapshot} onRefresh={() => void loadSnapshot()} onOpenTask={openTask} />
        ) : null}

        {activeView === "tasks" ? (
          <TasksPage
            tasks={snapshot.tasks}
            selectedTaskId={selectedTaskId}
            registerConfig={registerConfig}
            busy={busy}
            onRefresh={() => void loadSnapshot()}
            onSelectTask={setSelectedTaskId}
            onConfigChange={(patch) => setRegisterConfig((current) => ({ ...current, ...patch }))}
            onRunTask={(payload, successText) => void runTask(payload, successText)}
          />
        ) : null}

        {activeView === "accounts" ? (
          <AccountsPage
            accounts={filteredAccounts}
            keyword={accountKeyword}
            status={accountStatus}
            busy={busy}
            onKeywordChange={setAccountKeyword}
            onStatusChange={setAccountStatus}
            onRefresh={() => void loadSnapshot()}
            onImport={() => void importAccounts()}
            onExport={() => void exportAccounts()}
          />
        ) : null}

        {activeView === "proxies" ? (
          <ProxiesPage
            proxies={snapshot.proxies}
            busy={busy}
            onImport={() => void importProxies()}
            onRefresh={() => void loadSnapshot()}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsPage
            settings={settingsDraft}
            busy={busy}
            onChange={setSettingsDraft}
            onSave={(event) => void saveSettings(event)}
          />
        ) : null}
      </main>
    </div>
  );
}
