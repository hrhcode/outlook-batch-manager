export interface SnapshotSummary {
  account_count: number;
  proxy_count: number;
  task_count: number;
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
  created_at: string | null;
  last_login_check_at: string | null;
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
}

export interface AppSnapshot {
  generated_at: string;
  summary: SnapshotSummary;
  accounts: AccountItem[];
  tasks: TaskItem[];
  proxies: ProxyItem[];
  settings: AppSettings;
}

export interface RunTaskPayload {
  taskType: "register" | "login_check" | "token_refresh";
  batchSize?: number;
  concurrentWorkers?: number;
  maxRetries?: number;
  fetchToken?: boolean;
  headless?: boolean;
}

