/// <reference types="vite/client" />

import type { AppSettings, AppSnapshot, MailListResult } from "./types";

interface DesktopApi {
  getSnapshot: () => Promise<AppSnapshot>;
  saveSettings: (payload: AppSettings) => Promise<{ saved: boolean }>;
  runLegacyTask: (payload: {
    taskType: "register" | "login_check";
    batchSize?: number;
    concurrentWorkers?: number;
    maxRetries?: number;
    fetchToken?: boolean;
    headless?: boolean;
    accountId?: number;
  }) => Promise<{ task_id: number }>;
  authorizeAccount: (payload: { accountId: number }) => Promise<{ email_address: string; account_id: number }>;
  testAccountMailCapability: (accountId: number) => Promise<{ message: string; success: boolean }>;
  deleteAccounts: (payload: { accountIds: number[] }) => Promise<{ deleted: number }>;
  syncMailBatch: (payload: { accountIds: number[]; limit?: number }) => Promise<{ success: number; failed: number }>;
  listMail: (payload: {
    accountId?: number;
    keyword?: string;
    unreadOnly?: boolean;
    source?: string;
  }) => Promise<MailListResult>;
  updateAccountAuth: (payload: { accountId: number; clientId?: string; refreshToken?: string }) => Promise<{ updated: boolean; account_id: number }>;
  importAccounts: () => Promise<{ imported: number; path: string } | { cancelled: true }>;
  importProxies: () => Promise<{ imported: number; path: string } | { cancelled: true }>;
  getMeta: () => Promise<{ projectRoot: string; pythonExecutable: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
