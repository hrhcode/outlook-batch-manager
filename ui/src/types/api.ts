export type AccountSummary = {
  id: number;
  email: string;
  password: string;
  client_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  sync_mode: "idle" | "poll" | null;
  last_synced_at: string | null;
  account_status: "disconnected" | "connecting" | "connected";
  last_test_status: string;
  last_error: string | null;
  message_count: number;
  updated_at: string;
};

export type MailPreview = {
  id: number;
  subject: string;
  sender: string;
  snippet: string;
  received_at: string | null;
};

export type AccountDetail = AccountSummary & {
  recent_messages: MailPreview[];
};

export type ImportFailure = {
  line_number: number;
  raw: string;
  reason: string;
};

export type ImportResponse = {
  imported: number;
  updated: number;
  failures: ImportFailure[];
};

export type AccountTestResult = {
  id: number;
  status: string;
  message: string;
  tested_at: string;
};

export type MailMessageSummary = {
  id: number;
  account_id: number;
  subject: string;
  sender: string;
  recipients: string | null;
  snippet: string;
  received_at: string | null;
  synced_at: string;
};

export type MailMessageDetail = MailMessageSummary & {
  body_text: string | null;
  body_html: string | null;
  recipients: string | null;
};

export type HealthResponse = {
  status: string;
};

export type RegisterConfig = {
  browser: string;
  concurrent_flows: number;
  max_tasks: number;
  bot_protection_wait: number;
  max_captcha_retries: number;
  enable_oauth2: boolean;
};

export type RegisterTaskStatus = {
  id: number;
  status: string;
  total_count: number;
  succeeded_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
};

export type RegisterProgress = {
  task_id: number;
  current: number;
  total: number;
  succeeded: number;
  failed: number;
  latest_email: string | null;
  latest_status: string;
  message: string;
};

export type OAuth2Settings = {
  client_id: string;
  redirect_url: string;
  scopes: string[];
};

export type ProxyItem = {
  id: number;
  proxy_url: string;
  is_enabled: boolean;
  last_used_at: string | null;
  success_count: number;
  fail_count: number;
};
