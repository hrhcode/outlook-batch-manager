import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  runTask: (payload) => ipcRenderer.invoke("app:runTask", payload),
  saveSettings: (payload) => ipcRenderer.invoke("app:saveSettings", payload),
  importAccounts: () => ipcRenderer.invoke("app:importAccounts"),
  exportAccounts: (payload) => ipcRenderer.invoke("app:exportAccounts", payload),
  importProxies: () => ipcRenderer.invoke("app:importProxies"),
  createAccount: (payload) => ipcRenderer.invoke("app:createAccount", payload),
  testAccount: (accountId) => ipcRenderer.invoke("app:testAccount", accountId),
  syncMail: (payload) => ipcRenderer.invoke("app:syncMail", payload),
  listMail: (payload) => ipcRenderer.invoke("app:listMail", payload),
  getMeta: () => ipcRenderer.invoke("app:meta"),
});
