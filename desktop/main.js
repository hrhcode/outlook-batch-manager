const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const { join, resolve } = require("node:path");

const {
  createRuntimeConfig,
  findOpenPort,
  startBackend,
  stopBackend,
  waitForBackend
} = require("./backend-manager");

const projectRoot = resolve(__dirname, "..");

let mainWindow;
let runtimeConfig;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f4f4ef",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(projectRoot, "ui", "dist", "index.html"));
  }

  mainWindow.setMenuBarVisibility(false);
}

async function bootstrapBackend() {
  const port = await findOpenPort();
  runtimeConfig = createRuntimeConfig(app.getPath("userData"), port);
  await mkdir(runtimeConfig.dataDir, { recursive: true });
  backendProcess = startBackend({ projectRoot, runtimeConfig });

  backendProcess.on("exit", (code) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend:crash", {
        code,
        message: "Local backend process exited unexpectedly."
      });
    }
  });

  await waitForBackend(runtimeConfig.apiBaseUrl, runtimeConfig.apiToken);
}

ipcMain.handle("desktop:get-runtime-config", async () => runtimeConfig);

ipcMain.handle("desktop:save-export-file", async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(app.getPath("documents"), payload.defaultName || "accounts-export.txt"),
    filters: [{ name: "Text Files", extensions: ["txt"] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await writeFile(result.filePath, payload.content, "utf8");
  return { filePath: result.filePath };
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await bootstrapBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend(backendProcess);
});
