/// <reference types="vite/client" />

import type { AppSettings, AppSnapshot, ExportResult, ImportResult, RunTaskPayload } from "./types";

interface DesktopApi {
  getSnapshot: () => Promise<AppSnapshot>;
  runTask: (payload: RunTaskPayload) => Promise<{ task_id: number }>;
  saveSettings: (payload: AppSettings) => Promise<{ saved: boolean }>;
  importAccounts: () => Promise<ImportResult | { cancelled: true }>;
  exportAccounts: (payload: { keyword?: string; status?: string }) => Promise<ExportResult | { cancelled: true }>;
  importProxies: () => Promise<ImportResult | { cancelled: true }>;
  getMeta: () => Promise<{ projectRoot: string; pythonExecutable: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
