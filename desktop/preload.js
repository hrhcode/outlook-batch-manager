const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getRuntimeConfig: () => ipcRenderer.invoke("desktop:get-runtime-config"),
  saveExportFile: (payload) => ipcRenderer.invoke("desktop:save-export-file", payload),
  onBackendCrash: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("backend:crash", listener);

    return () => {
      ipcRenderer.removeListener("backend:crash", listener);
    };
  }
});
