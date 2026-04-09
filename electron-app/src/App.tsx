import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { StatusBanner } from "./components/StatusBanner";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { NAV_ITEMS, VIEW_META } from "./lib/content";
import { compactPath, formatDateTime } from "./lib/format";
import { AccountsPage } from "./pages/AccountsPage";
import { BatchRegisterPage } from "./pages/BatchRegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MailPage } from "./pages/MailPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { AppSettings, AppSnapshot, AppView, MailMessageItem, ThemeMode } from "./types";

const emptySettings: AppSettings = {
  browser_channel: "chromium",
  browser_executable_path: "",
  headless: false,
  timeout_ms: 30000,
  captcha_wait_ms: 12000,
  user_agent: "",
  mock_mode: false,
  oauth: {
    client_id: "",
    redirect_uri: "http://127.0.0.1:8787/oauth/callback",
    scopes: ["offline_access", "https://outlook.office.com/IMAP.AccessAsUser.All"],
  },
  mail: {
    sync_batch_size: 20,
    poll_interval_minutes: 1,
  },
  mail_protocols: {
    imap: { enabled: true, host: "outlook.office365.com", port: 993, use_ssl: true },
  },
};

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [meta, setMeta] = useState<{ projectRoot: string; pythonExecutable: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(emptySettings);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [registerConfig, setRegisterConfig] = useState({
    batchSize: 5,
    concurrentWorkers: 2,
    maxRetries: 1,
    fetchToken: true,
    headless: false,
  });
  const [mailFilters, setMailFilters] = useState({
    accountId: null as number | null,
    keyword: "",
    unreadOnly: false,
    source: "",
  });
  const [mailMessages, setMailMessages] = useState<MailMessageItem[]>([]);

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
      const [nextSnapshot, nextMeta] = await Promise.all([window.desktopApi.getSnapshot(), window.desktopApi.getMeta()]);
      setSnapshot(nextSnapshot);
      setMeta(nextMeta);
      setSettingsDraft(nextSnapshot.settings);

      const registerTasks = nextSnapshot.tasks.filter((task) => task.task_type === "register");
      if (registerTasks.length > 0) {
        const selectedStillExists = registerTasks.some((task) => task.id === selectedTaskId);
        if (selectedTaskId === null || !selectedStillExists) {
          setSelectedTaskId(registerTasks[0].id);
        }
      }

      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取工作台快照失败。");
    } finally {
      setLoading(false);
    }
  }

  async function loadMail() {
    setMailLoading(true);
    try {
      const result = await window.desktopApi.listMail({
        accountId: mailFilters.accountId ?? undefined,
        keyword: mailFilters.keyword,
        unreadOnly: mailFilters.unreadOnly,
        source: mailFilters.source,
      });
      setMailMessages(result.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取邮件列表失败。");
    } finally {
      setMailLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeView === "mail") {
      void loadMail();
    }
  }, [activeView, mailFilters.accountId, mailFilters.keyword, mailFilters.unreadOnly, mailFilters.source]);

  useEffect(() => {
    if (activeView !== "mail") {
      return;
    }
    const timer = window.setInterval(() => {
      void loadMail();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeView, mailFilters.accountId, mailFilters.keyword, mailFilters.unreadOnly, mailFilters.source]);

  const currentViewMeta = VIEW_META[activeView];
  const accounts = useMemo(() => snapshot?.accounts ?? [], [snapshot]);
  const connectedAccounts = useMemo(() => accounts.filter((item) => item.connectivity_status === "connected"), [accounts]);
  const registerTasks = useMemo(() => (snapshot?.tasks ?? []).filter((task) => task.task_type === "register"), [snapshot]);
  const currentNav = NAV_ITEMS.find((item) => item.id === activeView) ?? NAV_ITEMS[0];

  async function authorizeAccount(accountId: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.authorizeAccount({ accountId });
      await loadSnapshot();
      setNotice(`已完成 IMAP OAuth 授权：${result.email_address}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "补充 IMAP OAuth 授权失败。");
    } finally {
      setBusy(false);
    }
  }

  async function updateAccountAuth(accountId: number, payload: { clientId?: string; refreshToken?: string }) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await window.desktopApi.updateAccountAuth({
        accountId,
        ...(payload.clientId ? { clientId: payload.clientId } : {}),
        ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
      });
      await loadSnapshot();
      setNotice("账号凭证已更新，可以继续做联通检测。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新账号凭证失败。");
    } finally {
      setBusy(false);
    }
  }

  async function runRegisterTask() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.runLegacyTask({
        taskType: "register",
        batchSize: registerConfig.batchSize,
        concurrentWorkers: registerConfig.concurrentWorkers,
        maxRetries: registerConfig.maxRetries,
        fetchToken: registerConfig.fetchToken,
        headless: registerConfig.headless,
      });
      setSelectedTaskId(result.task_id);
      await loadSnapshot();
      setNotice("批量注册任务已启动。");
      setActiveView("register");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "启动批量注册任务失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await window.desktopApi.saveSettings(settingsDraft);
      await loadSnapshot();
      setNotice(`设置已保存，当前模式为${settingsDraft.mock_mode ? "测试 / 演示" : "生产"}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存设置失败。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccounts(accountIds: number[]) {
    if (accountIds.length === 0) {
      setError("");
      setNotice("请先选择要删除的账号。");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.deleteAccounts({ accountIds });
      await Promise.all([loadSnapshot(), loadMail()]);
      setNotice(`已删除 ${result.deleted} 个账号。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除账号失败。");
    } finally {
      setBusy(false);
    }
  }

  async function testAccount(accountId: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.testAccountMailCapability(accountId);
      await loadSnapshot();
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "检测账号联通能力失败。");
    } finally {
      setBusy(false);
    }
  }

  async function testAccounts(accountIds: number[]) {
    if (accountIds.length === 0) {
      setError("");
      setNotice("请先选择要检测的账号。");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    let success = 0;
    const failedIds: number[] = [];

    try {
      for (const accountId of accountIds) {
        try {
          const result = await window.desktopApi.testAccountMailCapability(accountId);
          if (result.success) {
            success += 1;
          } else {
            failedIds.push(accountId);
          }
        } catch {
          failedIds.push(accountId);
        }
      }

      await loadSnapshot();
      setNotice(`批量检测完成：成功 ${success} 个，失败 ${failedIds.length} 个。`);
      if (failedIds.length > 0) {
        setError(`以下账号检测失败：${failedIds.slice(0, 6).join("、")}${failedIds.length > 6 ? " 等" : ""}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function syncAccounts(accountIds: number[]) {
    if (accountIds.length === 0) {
      setError("");
      setNotice("当前没有可同步的账号。");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.syncMailBatch({ accountIds, limit: settingsDraft.mail.sync_batch_size });
      await Promise.all([loadSnapshot(), loadMail()]);
      setNotice(`邮件同步完成：成功 ${result.success} 个，失败 ${result.failed} 个。`);
      setActiveView("mail");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批量同步邮件失败。");
    } finally {
      setBusy(false);
    }
  }

  async function importProxies() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.importProxies();
      if (!("cancelled" in result)) {
        await loadSnapshot();
        setNotice(`已导入 ${result.imported} 条代理。`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入代理失败。");
    } finally {
      setBusy(false);
    }
  }

  async function importAccounts() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.importAccounts();
      if (!("cancelled" in result)) {
        await loadSnapshot();
        setNotice(`已批量导入 ${result.imported} 个账号。`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批量导入账号失败。");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !snapshot) {
    return <div className="app-loading">正在加载桌面工作台...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <span className="brand-pill">Desktop Ops Console</span>
          <h1>Outlook Batch Manager</h1>
          <p>批量注册、账号运营与邮件同步的统一桌面工作台。</p>
        </div>

        <nav className="nav-list" aria-label="main navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className={activeView === item.id ? "nav-item active" : "nav-item"} onClick={() => setActiveView(item.id)}>
              <span className="nav-item-title">{item.label}</span>
              <span className="nav-item-caption">{item.caption}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <div className="meta-block">
            <span>当前页面</span>
            <strong>{currentNav.label}</strong>
            <p>{currentViewMeta.description}</p>
          </div>
          <div className="meta-block">
            <span>项目目录</span>
            <strong>{compactPath(meta?.projectRoot ?? "—", 36)}</strong>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-topbar">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>统一桌面运营工作台</h2>
            <p className="workspace-subtitle">最新快照 {formatDateTime(snapshot.generated_at)} · 账号 {snapshot.summary.account_count} · 邮件 {snapshot.mail_summary.total_messages}</p>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => void loadSnapshot()} disabled={busy}>
              刷新快照
            </button>
            <ThemeSwitch theme={theme} onChange={setTheme} />
          </div>
        </header>

        <StatusBanner error={error} notice={notice} />

        {activeView === "dashboard" ? <DashboardPage snapshot={snapshot} meta={meta} onNavigate={setActiveView} /> : null}

        {activeView === "register" ? (
          <BatchRegisterPage
            tasks={registerTasks}
            selectedTaskId={selectedTaskId}
            registerConfig={registerConfig}
            busy={busy}
            onSelectTask={setSelectedTaskId}
            onConfigChange={(patch) => setRegisterConfig((current) => ({ ...current, ...patch }))}
            onRunRegister={() => void runRegisterTask()}
            onRefresh={() => void loadSnapshot()}
          />
        ) : null}

        {activeView === "accounts" ? (
          <AccountsPage
            accounts={accounts}
            busy={busy}
            onRefresh={() => void loadSnapshot()}
            onImportAccounts={() => void importAccounts()}
            onAuthorizeAccount={(accountId) => void authorizeAccount(accountId)}
            onDeleteAccounts={(accountIds) => void deleteAccounts(accountIds)}
            onTestAccount={(accountId) => void testAccount(accountId)}
            onTestAccounts={(accountIds) => void testAccounts(accountIds)}
            onSyncAccounts={(accountIds) => void syncAccounts(accountIds)}
            onUpdateAccountAuth={(accountId, payload) => void updateAccountAuth(accountId, payload)}
          />
        ) : null}

        {activeView === "mail" ? (
          <MailPage
            accounts={connectedAccounts}
            messages={mailMessages}
            recentRuns={snapshot.recent_mail_sync}
            filters={mailFilters}
            busy={busy}
            loading={mailLoading}
            onFiltersChange={(patch) => setMailFilters((current) => ({ ...current, ...patch }))}
            onSyncAccounts={(accountIds) => void syncAccounts(accountIds)}
            onRefresh={() => void loadMail()}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsPage settings={settingsDraft} proxies={snapshot.proxies} busy={busy} onChange={setSettingsDraft} onSave={(event) => void saveSettings(event)} onImportProxies={() => void importProxies()} />
        ) : null}
      </main>
    </div>
  );
}
