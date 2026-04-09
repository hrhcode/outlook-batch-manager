/// <reference types="vite/client" />

import type { AppSettings, AppSnapshot, RunTaskPayload } from "./types";

interface DesktopApi {
  getSnapshot: () => Promise<AppSnapshot>;
  runTask: (payload: RunTaskPayload) => Promise<{ task_id: number }>;
  saveSettings: (payload: AppSettings) => Promise<{ saved: boolean }>;
  getMeta: () => Promise<{ projectRoot: string; pythonExecutable: string }>;
}

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};

