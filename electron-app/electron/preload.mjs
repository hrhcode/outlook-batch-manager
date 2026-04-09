import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  saveSettings: (payload) => ipcRenderer.invoke("app:saveSettings", payload),
  runLegacyTask: (payload) => ipcRenderer.invoke("app:runLegacyTask", payload),
  authorizeAccount: (payload) => ipcRenderer.invoke("app:authorizeAccount", payload),
  testAccountMailCapability: (accountId) => ipcRenderer.invoke("app:testAccountMailCapability", accountId),
  deleteAccounts: (payload) => ipcRenderer.invoke("app:deleteAccounts", payload),
  syncMailBatch: (payload) => ipcRenderer.invoke("app:syncMailBatch", payload),
  listMail: (payload) => ipcRenderer.invoke("app:listMail", payload),
  updateAccountAuth: (payload) => ipcRenderer.invoke("app:updateAccountAuth", payload),
  importAccounts: () => ipcRenderer.invoke("app:importAccounts"),
  importProxies: () => ipcRenderer.invoke("app:importProxies"),
  getMeta: () => ipcRenderer.invoke("app:meta"),
});
