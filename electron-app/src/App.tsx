import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { StatusBanner } from "./components/StatusBanner";
import { ThemeSwitch } from "./components/ThemeSwitch";
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

const navigation: Array<{ id: AppView; label: string }> = [
  { id: "dashboard", label: "仪表盘" },
  { id: "register", label: "批量注册" },
  { id: "accounts", label: "账号中心" },
  { id: "mail", label: "邮件中心" },
  { id: "settings", label: "设置" },
];

const viewContent: Record<AppView, { title: string; description: string }> = {
  dashboard: { title: "仪表盘", description: "查看账号池、IMAP 收件同步和运行状态的总览信息。" },
  register: { title: "批量注册", description: "保留批量注册作为系统核心能力，并与账号中心协同工作。" },
  accounts: { title: "账号中心", description: "统一管理账号导入、IMAP OAuth 授权补齐、联通检测和批量删除。" },
  mail: { title: "邮件中心", description: "只针对已联通账号进行 IMAP 收件同步，并查看邮件列表和详情。" },
  settings: { title: "设置", description: "配置 IMAP OAuth、同步参数、代理池和测试模式。" },
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
      setError(caught instanceof Error ? caught.message : "读取工作台数据失败。");
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

  const currentView = viewContent[activeView];
  const accounts = useMemo(() => snapshot?.accounts ?? [], [snapshot]);
  const connectedAccounts = useMemo(() => accounts.filter((item) => item.connectivity_status === "connected"), [accounts]);
  const registerTasks = useMemo(() => (snapshot?.tasks ?? []).filter((task) => task.task_type === "register"), [snapshot]);

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
      setNotice(`设置已保存，当前模式为 ${settingsDraft.mock_mode ? "测试" : "生产"}。`);
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

  async function syncAccounts(accountIds: number[]) {
    if (accountIds.length === 0) {
      setError("");
      setNotice("当前没有可同步的已联通账号。");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await window.desktopApi.syncMailBatch({ accountIds, limit: settingsDraft.mail.sync_batch_size });
      await Promise.all([loadSnapshot(), loadMail()]);
      setNotice(`批量同步完成：成功 ${result.success} 个，失败 ${result.failed} 个。`);
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
    return <div className="shell loading">Loading workspace...</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Outlook IMAP Console</h1>
        </div>

        <nav className="nav-list" aria-label="main navigation">
          {navigation.map((item) => (
            <button key={item.id} type="button" className={activeView === item.id ? "nav-button active" : "nav-button"} onClick={() => setActiveView(item.id)}>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <section className="topbar">
          <div className="topbar-copy">
            <h2>{currentView.title}</h2>
            <p>{currentView.description}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" onClick={() => void loadSnapshot()} disabled={busy}>
              <span aria-hidden="true">刷新</span>
            </button>
            <ThemeSwitch theme={theme} onChange={setTheme} />
          </div>
        </section>

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
            onSyncAccounts={(accountIds) => void syncAccounts(accountIds)}
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
          <SettingsPage
            settings={settingsDraft}
            proxies={snapshot.proxies}
            busy={busy}
            onChange={setSettingsDraft}
            onSave={(event) => void saveSettings(event)}
            onImportProxies={() => void importProxies()}
          />
        ) : null}
      </main>
    </div>
  );
}
