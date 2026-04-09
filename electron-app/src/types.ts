export type ThemeMode = "dark" | "light";
export type AppView = "dashboard" | "register" | "accounts" | "mail" | "settings";
export type MailSource = "auto" | "graph" | "imap" | "pop" | "mock";

export interface SnapshotSummary {
  account_count: number;
  proxy_count: number;
  task_count: number;
  active_account_count: number;
  pending_account_count: number;
  connected_account_count: number;
}

export interface LatestTaskSummary {
  id: number | null;
  task_type: string;
  status: string;
  success_count: number;
  failure_count: number;
  finished_at: string | null;
  latest_error: string;
}

export interface SnapshotAlert {
  kind: "error" | "warning" | "info";
  title: string;
  detail: string;
  task_id?: number | null;
}

export interface AccountItem {
  id: number | null;
  email: string;
  password: string;
  status: string;
  source: string;
  group_name: string;
  notes: string;
  recovery_email: string;
  mail_provider: string;
  client_id_override: string;
  import_format: string;
  connectivity_status: string;
  created_at: string | null;
  last_login_check_at: string | null;
  last_connectivity_check_at: string | null;
  token_status: string;
  token_expires_at: string | null;
}

export interface TaskLogItem {
  id: number | null;
  level: string;
  message: string;
  account_email: string;
  created_at: string | null;
}

export interface TaskItem {
  id: number | null;
  task_type: string;
  status: string;
  success_count: number;
  failure_count: number;
  started_at: string | null;
  finished_at: string | null;
  latest_error: string;
  config_snapshot: Record<string, unknown>;
  recent_logs: TaskLogItem[];
}

export interface ProxyItem {
  id: number | null;
  server: string;
  enabled: boolean;
  status: string;
  last_used_at: string | null;
}

export interface MailSyncRun {
  id: number | null;
  account_id: number | null;
  source: string;
  status: string;
  message_count: number;
  latest_error: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface MailSummary {
  total_messages: number;
  unread_messages: number;
  latest_run: MailSyncRun | null;
}

export interface MailMessageItem {
  id: number | null;
  account_id: number;
  account_email: string;
  mail_provider: string;
  source: string;
  message_id: string;
  internet_message_id: string;
  folder_name: string;
  subject: string;
  from_address: string;
  to_address: string;
  received_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  snippet: string;
  raw_payload: string;
  synced_at: string | null;
}

export interface MailSyncSettings {
  default_source: MailSource;
  batch_limit: number;
  unread_only: boolean;
  graph_fallback_to_imap: boolean;
}

export interface MailProtocolSettings {
  enabled: boolean;
  host: string;
  port: number;
  use_ssl: boolean;
}

export interface AppSettings {
  browser_channel: string;
  browser_executable_path: string;
  headless: boolean;
  timeout_ms: number;
  captcha_wait_ms: number;
  user_agent: string;
  use_mock_driver: boolean;
  client_id: string;
  redirect_url: string;
  scopes: string[];
  mail_sync: MailSyncSettings;
  mail_protocols: {
    imap: MailProtocolSettings;
    pop: MailProtocolSettings;
  };
}

export interface AppSnapshot {
  generated_at: string;
  summary: SnapshotSummary;
  latest_task_summary: LatestTaskSummary | null;
  alerts: SnapshotAlert[];
  accounts: AccountItem[];
  tasks: TaskItem[];
  proxies: ProxyItem[];
  settings: AppSettings;
  mail_summary: MailSummary;
  recent_mail_sync: MailSyncRun[];
}

export interface RunTaskPayload {
  taskType: "register" | "login_check" | "token_refresh" | "mail_sync";
  batchSize?: number;
  concurrentWorkers?: number;
  maxRetries?: number;
  fetchToken?: boolean;
  headless?: boolean;
  accountId?: number;
  source?: MailSource;
  limit?: number;
  unreadOnly?: boolean;
}

export interface ImportResult {
  imported: number;
  path: string;
  cancelled?: boolean;
}

export interface ExportResult {
  exported: number;
  path: string;
  cancelled?: boolean;
}

export interface CreateAccountPayload {
  email: string;
  password: string;
  provider: "outlook" | "hotmail";
  groupName: string;
  notes: string;
  recoveryEmail: string;
  clientIdOverride: string;
  refreshToken: string;
}

export interface ConnectivityResult {
  account_id: number;
  success: boolean;
  message: string;
  status: string;
  connectivity_status: string;
  last_connectivity_check_at: string | null;
}

export interface MailQueryPayload {
  accountId?: number;
  keyword?: string;
  unreadOnly?: boolean;
  source?: string;
}

export interface MailListResult {
  messages: MailMessageItem[];
}
