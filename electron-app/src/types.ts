export type ThemeMode = "dark" | "light";
export type AppView = "dashboard" | "register" | "accounts" | "mail" | "settings";

export interface SnapshotSummary {
  account_count: number;
  connected_account_count: number;
  connectable_count: number;
  action_required_count: number;
  proxy_count: number;
  legacy_task_count: number;
}

export interface SnapshotAlert {
  kind: "error" | "warning" | "info";
  title: string;
  detail: string;
}

export interface AccountItem {
  id: number | null;
  email: string;
  status: string;
  group_name: string;
  notes: string;
  recovery_email: string;
  mail_provider: string;
  import_format: string;
  connectivity_status: string;
  mail_capability_status: string;
  last_connectivity_check_at: string | null;
  last_mail_sync_at: string | null;
  last_error: string;
  has_client_id: boolean;
  has_refresh_token: boolean;
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
  account_id: number | null;
  account_email: string;
  account_group_name: string;
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

export interface AppSettings {
  browser_channel: string;
  browser_executable_path: string;
  headless: boolean;
  timeout_ms: number;
  captcha_wait_ms: number;
  user_agent: string;
  mock_mode: boolean;
  oauth: {
    client_id: string;
    redirect_uri: string;
    scopes: string[];
  };
  mail: {
    sync_batch_size: number;
    poll_interval_minutes: number;
  };
  mail_protocols: {
    imap: { enabled: boolean; host: string; port: number; use_ssl: boolean };
  };
}

export interface AppSnapshot {
  generated_at: string;
  summary: SnapshotSummary;
  accounts: AccountItem[];
  tasks: TaskItem[];
  proxies: ProxyItem[];
  settings: AppSettings;
  mail_summary: MailSummary;
  recent_mail_sync: MailSyncRun[];
  alerts: SnapshotAlert[];
  latest_task_summary: {
    id: number | null;
    task_type: string;
    status: string;
    success_count: number;
    failure_count: number;
    finished_at: string | null;
    latest_error: string;
  } | null;
}

export interface MailListResult {
  messages: MailMessageItem[];
}
