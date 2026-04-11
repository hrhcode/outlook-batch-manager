import type {
  AccountDetail,
  AccountSummary,
  AccountTestResult,
  HealthResponse,
  ImportResponse,
  MailMessageDetail,
  MailMessageSummary,
  OAuth2Settings,
  ProxyItem,
  RegisterConfig,
  RegisterTaskStatus,
} from "../types/api";
import type { RuntimeConfig } from "../types/desktop";

let cachedRuntimeConfig: Promise<RuntimeConfig> | null = null;

async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = window.desktop?.getRuntimeConfig?.() ??
      Promise.resolve({
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8765",
        apiToken: import.meta.env.VITE_API_TOKEN || "dev-token",
        apiPort: 8765,
        dataDir: ""
      });
  }

  return cachedRuntimeConfig;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const runtime = await getRuntimeConfig();
  const response = await fetch(`${runtime.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Desktop-Token": runtime.apiToken,
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(payload?.detail || `Request failed with ${response.status}`);
    }

    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  return (await response.text()) as T;
}

export async function subscribeToEvents(
  handlers: Record<string, (payload: unknown) => void>
): Promise<() => void> {
  const runtime = await getRuntimeConfig();
  const url = new URL(`${runtime.apiBaseUrl}/events/stream`);
  url.searchParams.set("token", runtime.apiToken);

  const source = new EventSource(url.toString());
  Object.entries(handlers).forEach(([eventName, handler]) => {
    source.addEventListener(eventName, (event) => {
      handler(JSON.parse((event as MessageEvent).data));
    });
  });

  return () => source.close();
}

export async function saveExportFile(payload: { defaultName?: string; content: string }) {
  return window.desktop?.saveExportFile?.(payload) ?? null;
}

export function healthCheck() {
  return request<HealthResponse>("/health", { method: "GET" });
}

export function listAccounts(params: { query?: string; accountStatus?: string }) {
  const url = new URL("/accounts", "http://placeholder");
  if (params.query) {
    url.searchParams.set("query", params.query);
  }
  if (params.accountStatus) {
    url.searchParams.set("account_status", params.accountStatus);
  }
  return request<AccountSummary[]>(`${url.pathname}${url.search}`);
}

export function getAccount(id: number) {
  return request<AccountDetail>(`/accounts/${id}`);
}

export function createAccount(payload: { email: string; password: string; client_id: string; refresh_token: string }) {
  return request<AccountSummary>("/accounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function importAccountsFile(file: File) {
  const runtime = await getRuntimeConfig();
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch(`${runtime.apiBaseUrl}/accounts/import-file`, {
    method: "POST",
    headers: {
      "X-Desktop-Token": runtime.apiToken
    },
    body: formData
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return (await response.json()) as ImportResponse;
}

export async function exportAccounts(params: { ids?: number[]; query?: string; accountStatus?: string }) {
  const url = new URL("/accounts/export", "http://placeholder");
  (params.ids || []).forEach((id) => url.searchParams.append("ids", String(id)));
  if (params.query) {
    url.searchParams.set("query", params.query);
  }
  if (params.accountStatus) {
    url.searchParams.set("account_status", params.accountStatus);
  }
  return request<string>(`${url.pathname}${url.search}`, { method: "GET" });
}

export function testAccount(id: number) {
  return request<AccountTestResult>("/accounts/test", {
    method: "POST",
    body: JSON.stringify({ id })
  });
}

export function listMessages(params: { accountId?: number; query?: string }) {
  const url = new URL("/mail/messages", "http://placeholder");
  if (params.accountId) {
    url.searchParams.set("account_id", String(params.accountId));
  }
  if (params.query) {
    url.searchParams.set("query", params.query);
  }
  return request<MailMessageSummary[]>(`${url.pathname}${url.search}`);
}

export function getMessage(id: number) {
  return request<MailMessageDetail>(`/mail/messages/${id}`);
}

export function startRegisterTask(config: RegisterConfig) {
  return request<RegisterTaskStatus>("/register/start", {
    method: "POST",
    body: JSON.stringify({ config })
  });
}

export function getRegisterStatus(taskId: number) {
  return request<RegisterTaskStatus>(`/register/status/${taskId}`);
}

export function cancelRegisterTask(taskId: number) {
  return request(`/register/cancel/${taskId}`, { method: "POST" });
}

export function getOAuth2Settings() {
  return request<OAuth2Settings>("/settings/oauth2");
}

export function updateOAuth2Settings(settings: OAuth2Settings) {
  return request<OAuth2Settings>("/settings/oauth2", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}

export function listProxies() {
  return request<ProxyItem[]>("/proxy");
}

export function addProxy(proxyUrl: string) {
  return request<ProxyItem>("/proxy", {
    method: "POST",
    body: JSON.stringify({ proxy_url: proxyUrl })
  });
}

export function updateProxy(id: number, data: { is_enabled?: boolean }) {
  return request<ProxyItem>(`/proxy/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function deleteProxy(id: number) {
  return request(`/proxy/${id}`, { method: "DELETE" });
}
