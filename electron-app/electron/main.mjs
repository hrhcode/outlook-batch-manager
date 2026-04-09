import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(appRoot, "..");

let mainWindow = null;
let backgroundMailTimer = null;
let backgroundMailRunning = false;

function getPythonExecutable() {
  return path.join(projectRoot, ".venv", "Scripts", "python.exe");
}

async function runCli(args) {
  const python = getPythonExecutable();
  const command = [python, "-m", "outlook_batch_manager.cli", ...args, "--root", projectRoot];
  const { stdout } = await execFileAsync(command[0], command.slice(1), {
    cwd: projectRoot,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
  return stdout.trim();
}

async function runCliJson(args) {
  const raw = await runCli(args);
  return JSON.parse(raw || "{}");
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1260,
    minHeight: 820,
    backgroundColor: "#111111",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(appRoot, "dist", "index.html"));
  }
}

async function syncDueMailInBackground() {
  if (backgroundMailRunning) {
    return;
  }
  backgroundMailRunning = true;
  try {
    await runCliJson(["sync-mail-due"]);
  } catch (errorCaught) {
    console.error("[mail-sync]", errorCaught);
  } finally {
    backgroundMailRunning = false;
  }
}

function appendOptionalArg(args, name, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  args.push(name, String(value));
}

async function authorizeAccount(accountId) {
  const session = await runCliJson(["create-auth-url", "--account-id", String(accountId)]);
  const authWindow = new BrowserWindow({
    width: 1080,
    height: 860,
    parent: mainWindow ?? undefined,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  return await new Promise((resolve, reject) => {
    let finished = false;

    const finish = async (targetUrl) => {
      if (finished) return;
      finished = true;
      try {
        const parsed = new URL(targetUrl);
        const error = parsed.searchParams.get("error");
        if (error) {
          throw new Error(parsed.searchParams.get("error_description") || error);
        }
        const code = parsed.searchParams.get("code");
        const state = parsed.searchParams.get("state");
        if (!code || !state) {
          throw new Error("OAuth 回调缺少 code 或 state。");
        }
        const result = await runCliJson([
          "complete-oauth",
          "--session-id",
          session.session_id,
          "--code",
          code,
          "--state",
          state,
        ]);
        try {
          authWindow.close();
        } catch {}
        resolve(result);
      } catch (errorCaught) {
        try {
          authWindow.close();
        } catch {}
        reject(errorCaught);
      }
    };

    const handleNavigation = (event, targetUrl) => {
      if (!targetUrl.startsWith(session.redirect_uri)) {
        return;
      }
      event.preventDefault();
      void finish(targetUrl);
    };

    authWindow.webContents.on("will-redirect", handleNavigation);
    authWindow.webContents.on("will-navigate", handleNavigation);
    authWindow.on("closed", () => {
      if (!finished) {
        reject(new Error("授权窗口在完成前被关闭。"));
      }
    });
    void authWindow.loadURL(session.authorization_url);
  });
}

app.whenReady().then(async () => {
  ipcMain.handle("app:snapshot", async () => runCliJson(["snapshot"]));
  ipcMain.handle("app:runLegacyTask", async (_event, payload) => {
    const args = ["run-task", "--task-type", payload.taskType];
    appendOptionalArg(args, "--batch-size", payload.batchSize ?? 5);
    appendOptionalArg(args, "--concurrent-workers", payload.concurrentWorkers ?? 2);
    appendOptionalArg(args, "--max-retries", payload.maxRetries ?? 1);
    if (payload.fetchToken) args.push("--fetch-token");
    if (payload.headless) args.push("--headless");
    appendOptionalArg(args, "--account-id", payload.accountId);
    return runCliJson(args);
  });
  ipcMain.handle("app:saveSettings", async (_event, payload) => {
    const tempFile = path.join(os.tmpdir(), `outlook-batch-manager-settings-${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf-8");
    try {
      return await runCliJson(["save-settings", "--file", tempFile]);
    } finally {
      await fs.rm(tempFile, { force: true });
    }
  });
  ipcMain.handle("app:authorizeAccount", async (_event, payload) => authorizeAccount(payload.accountId));
  ipcMain.handle("app:testAccountMailCapability", async (_event, accountId) =>
    runCliJson(["test-account-mail-capability", "--account-id", String(accountId)]),
  );
  ipcMain.handle("app:deleteAccounts", async (_event, payload) =>
    runCliJson(["delete-accounts", "--account-ids", payload.accountIds.join(",")]),
  );
  ipcMain.handle("app:syncMailBatch", async (_event, payload) => {
    const args = ["sync-mail-batch", "--account-ids", payload.accountIds.join(",")];
    appendOptionalArg(args, "--limit", payload.limit);
    return runCliJson(args);
  });
  ipcMain.handle("app:listMail", async (_event, payload) => {
    const args = ["list-mail"];
    appendOptionalArg(args, "--account-id", payload?.accountId);
    appendOptionalArg(args, "--keyword", payload?.keyword);
    appendOptionalArg(args, "--source", payload?.source);
    if (payload?.unreadOnly) args.push("--unread-only");
    return runCliJson(args);
  });
  ipcMain.handle("app:updateAccountAuth", async (_event, payload) => {
    const args = ["update-account-auth", "--account-id", String(payload.accountId)];
    appendOptionalArg(args, "--client-id", payload.clientId);
    appendOptionalArg(args, "--refresh-token", payload.refreshToken);
    return runCliJson(args);
  });
  ipcMain.handle("app:importAccounts", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入账号",
      properties: ["openFile"],
      filters: [
        { name: "账号文件", extensions: ["txt", "log", "csv", "xlsx", "xlsm", "xltx", "xltm"] },
        { name: "文本", extensions: ["txt", "log", "csv"] },
        { name: "Excel", extensions: ["xlsx", "xlsm", "xltx", "xltm"] },
        { name: "全部文件", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }
    return runCliJson(["import-accounts", "--file", result.filePaths[0]]);
  });
  ipcMain.handle("app:meta", async () => ({
    projectRoot,
    pythonExecutable: getPythonExecutable(),
  }));
  ipcMain.handle("app:importProxies", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入代理",
      properties: ["openFile"],
      filters: [
        { name: "文本", extensions: ["txt"] },
        { name: "全部文件", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }
    return runCliJson(["import-proxies", "--file", result.filePaths[0]]);
  });

  await createMainWindow();
  await syncDueMailInBackground();
  backgroundMailTimer = setInterval(() => {
    void syncDueMailInBackground();
  }, 30000);
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (backgroundMailTimer) {
    clearInterval(backgroundMailTimer);
    backgroundMailTimer = null;
  }
  if (process.platform !== "darwin") app.quit();
});
