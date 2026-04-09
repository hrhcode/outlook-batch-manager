import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  runTask: (payload) => ipcRenderer.invoke("app:runTask", payload),
  saveSettings: (payload) => ipcRenderer.invoke("app:saveSettings", payload),
  importAccounts: () => ipcRenderer.invoke("app:importAccounts"),
  exportAccounts: (payload) => ipcRenderer.invoke("app:exportAccounts", payload),
  importProxies: () => ipcRenderer.invoke("app:importProxies"),
  getMeta: () => ipcRenderer.invoke("app:meta"),
});
