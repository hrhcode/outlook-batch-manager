import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { StatusBanner } from "./components/StatusBanner";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { compactPath } from "./lib/format";
import { AccountsPage } from "./pages/AccountsPage";
import { BatchRegisterPage } from "./pages/BatchRegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MailPage } from "./pages/MailPage";
import { SettingsPage } from "./pages/SettingsPage";
import type {
  AppSettings,
  AppSnapshot,
  AppView,
  CreateAccountPayload,
  MailMessageItem,
  MailQueryPayload,
  ThemeMode,
} from "./types";

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
  mail_sync: {
    default_source: "auto",
    batch_limit: 20,
    unread_only: false,
    graph_fallback_to_imap: true,
  },
  mail_protocols: {
    imap: {
      enabled: false,
      host: "outlook.office365.com",
      port: 993,
      use_ssl: true,
    },
    pop: {
      enabled: false,
      host: "outlook.office365.com",
      port: 995,
      use_ssl: true,
    },
  },
};

const navigation: Array<{ id: AppView; label: string; eyebrow: string; description: string }> = [
  { id: "dashboard", label: "仪表盘", eyebrow: "Overview", description: "看全局概览" },
  { id: "register", label: "批量注册", eyebrow: "Register", description: "集中配置批次" },
  { id: "accounts", label: "账号库", eyebrow: "Accounts", description: "管理现有账号" },
  { id: "mail", label: "邮件", eyebrow: "Mailbox", description: "聚合查看收件" },
  { id: "settings", label: "设置", eyebrow: "Settings", description: "系统和协议参数" },
];

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [meta, setMeta] = useState<{ projectRoot: string; pythonExecutable: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
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
      if (activeView !== "settings" || !snapshot) {
        setSettingsDraft(nextSnapshot.settings);
      }
      const registerTasks = nextSnapshot.tasks.filter((task) => task.task_type === "register");
      if (registerTasks.length > 0) {
        const selectedStillExists = registerTasks.some((task) => task.id === selectedTaskId);
        if (selectedTaskId === null || !selectedStillExists) {
          setSelectedTaskId(registerTasks[0].id);
        }
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取工作台数据失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadMail(payload?: Partial<MailQueryPayload>) {
    setMailLoading(true);
    try {
      const result = await window.desktopApi.listMail({
        accountId: payload?.accountId ?? mailFilters.accountId ?? undefined,
        keyword: payload?.keyword ?? mailFilters.keyword,
        unreadOnly: payload?.unreadOnly ?? mailFilters.unreadOnly,
        source: payload?.source ?? mailFilters.source,
      });
      setMailMessages(result.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取邮件列表失败");
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

  const filteredAccounts = useMemo(() => {
    const allAccounts = snapshot?.accounts ?? [];
    return allAccounts.filter((account) => {
      const keywordMatch = !accountKeyword.trim()
        ? true
        : [account.email, account.group_name, account.notes, account.status, account.mail_provider]
            .join(" ")
            .toLowerCase()
            .includes(accountKeyword.toLowerCase());
      const statusMatch = accountStatus ? account.status === accountStatus : true;
      return keywordMatch && statusMatch;
    });
  }, [snapshot, accountKeyword, accountStatus]);

  const registerTasks = useMemo(
    () => (snapshot?.tasks ?? []).filter((task) => task.task_type === "register"),
    [snapshot],
  );

  async function runRegisterTask() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.runTask({
        taskType: "register",
        batchSize: registerConfig.batchSize,
        concurrentWorkers: registerConfig.concurrentWorkers,
        maxRetries: registerConfig.maxRetries,
        fetchToken: registerConfig.fetchToken,
        headless: registerConfig.headless,
      });
      setSelectedTaskId(result.task_id);
      await loadSnapshot();
      setActiveView("register");
      setNotice("批量注册任务已启动。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "启动注册任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function runBulkConnectivityTest() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await window.desktopApi.runTask({ taskType: "login_check" });
      await loadSnapshot();
      setNotice("批量联通测试已启动。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批量联通测试失败");
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
      setNotice("设置已保存。");
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
        setNotice(`已导入 ${result.imported} 条账号。`);
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
        setNotice(`已导出 ${result.exported} 条账号。`);
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
        setNotice(`已导入 ${result.imported} 条代理。`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入代理失败");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(payload: CreateAccountPayload) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await window.desktopApi.createAccount(payload);
      await loadSnapshot();
      setNotice("账号已写入账号库。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "手动添加账号失败");
    } finally {
      setBusy(false);
    }
  }

  async function testAccount(accountId: number) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await window.desktopApi.testAccount(accountId);
      await loadSnapshot();
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号联通测试失败");
    } finally {
      setBusy(false);
    }
  }

  async function syncMail() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await window.desktopApi.syncMail({
        accountId: mailFilters.accountId ?? undefined,
        source: mailFilters.source || settingsDraft.mail_sync.default_source,
        limit: settingsDraft.mail_sync.batch_limit,
        unreadOnly: mailFilters.unreadOnly,
      });
      await Promise.all([loadSnapshot(), loadMail()]);
      setNotice("邮件同步任务已完成。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "邮件同步失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !snapshot) {
    return <div className="shell loading">Loading workspace...</div>;
  }

  const viewMeta = navigation.find((item) => item.id === activeView) ?? navigation[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <p className="eyebrow">Electron + Python</p>
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
              <small>{item.description}</small>
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
            <p className="eyebrow">{viewMeta.eyebrow}</p>
            <h2>{viewMeta.label}</h2>
          </div>
          <div className="topbar-actions">
            <ThemeSwitch theme={theme} onChange={setTheme} />
            <button className="ghost-button" onClick={() => void loadSnapshot()} disabled={busy}>
              刷新工作台
            </button>
          </div>
        </section>

        <StatusBanner error={error} notice={notice} />

        {activeView === "dashboard" ? (
          <DashboardPage snapshot={snapshot} onNavigate={setActiveView} />
        ) : null}

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
            accounts={filteredAccounts}
            keyword={accountKeyword}
            status={accountStatus}
            busy={busy}
            onKeywordChange={setAccountKeyword}
            onStatusChange={setAccountStatus}
            onRefresh={() => void loadSnapshot()}
            onImport={() => void importAccounts()}
            onExport={() => void exportAccounts()}
            onCreateAccount={(payload) => void createAccount(payload)}
            onTestAccount={(accountId) => void testAccount(accountId)}
            onBulkTest={() => void runBulkConnectivityTest()}
          />
        ) : null}

        {activeView === "mail" ? (
          <MailPage
            accounts={snapshot.accounts}
            messages={mailMessages}
            recentRuns={snapshot.recent_mail_sync}
            filters={mailFilters}
            busy={busy}
            loading={mailLoading}
            onFiltersChange={(patch) => setMailFilters((current) => ({ ...current, ...patch }))}
            onSync={() => void syncMail()}
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
