export type RuntimeConfig = {
  apiBaseUrl: string;
  apiToken: string;
  apiPort: number;
  dataDir: string;
};

export type DesktopBridge = {
  getRuntimeConfig: () => Promise<RuntimeConfig>;
  saveExportFile: (payload: { defaultName?: string; content: string }) => Promise<{ filePath: string } | null>;
  onBackendCrash: (callback: (payload: { code: number | null; message: string }) => void) => () => void;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
