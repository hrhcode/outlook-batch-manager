/// <reference types="vite/client" />

import type {
  AppSettings,
  AppSnapshot,
  ConnectivityResult,
  CreateAccountPayload,
  ExportResult,
  ImportResult,
  MailListResult,
  MailQueryPayload,
  RunTaskPayload,
} from "./types";

interface DesktopApi {
  getSnapshot: () => Promise<AppSnapshot>;
  runTask: (payload: RunTaskPayload) => Promise<{ task_id: number }>;
  saveSettings: (payload: AppSettings) => Promise<{ saved: boolean }>;
  importAccounts: () => Promise<ImportResult | { cancelled: true }>;
  exportAccounts: (payload: { keyword?: string; status?: string }) => Promise<ExportResult | { cancelled: true }>;
  importProxies: () => Promise<ImportResult | { cancelled: true }>;
  createAccount: (payload: CreateAccountPayload) => Promise<{ created: boolean; account: unknown }>;
  testAccount: (accountId: number) => Promise<ConnectivityResult>;
  syncMail: (payload: {
    accountId?: number;
    source?: string;
    limit?: number;
    unreadOnly?: boolean;
  }) => Promise<{ task_id: number; latest_run: unknown }>;
  listMail: (payload: MailQueryPayload) => Promise<MailListResult>;
  getMeta: () => Promise<{ projectRoot: string; pythonExecutable: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
