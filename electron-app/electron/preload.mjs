import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  getSnapshot: () => ipcRenderer.invoke("app:snapshot"),
  runTask: (payload) => ipcRenderer.invoke("app:runTask", payload),
  saveSettings: (payload) => ipcRenderer.invoke("app:saveSettings", payload),
  getMeta: () => ipcRenderer.invoke("app:meta"),
});

