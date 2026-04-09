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
  });
  return stdout.trim();
}

async function runCliJson(args) {
  const raw = await runCli(args);
  return JSON.parse(raw || "{}");
}

async function createMainWindow() {
  const window = new BrowserWindow({
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
    await window.loadURL("http://127.0.0.1:5173");
  } else {
    await window.loadFile(path.join(appRoot, "dist", "index.html"));
  }
}

function appendOptionalArg(args, name, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  args.push(name, String(value));
}

app.whenReady().then(async () => {
  ipcMain.handle("app:snapshot", async () => runCliJson(["snapshot"]));
  ipcMain.handle("app:runTask", async (_event, payload) => {
    const args = ["run-task", "--task-type", payload.taskType];
    if (payload.taskType === "register") {
      appendOptionalArg(args, "--batch-size", payload.batchSize ?? 5);
      appendOptionalArg(args, "--concurrent-workers", payload.concurrentWorkers ?? 2);
      appendOptionalArg(args, "--max-retries", payload.maxRetries ?? 1);
      if (payload.fetchToken) args.push("--fetch-token");
      if (payload.headless) args.push("--headless");
    }
    if (payload.taskType === "login_check") {
      appendOptionalArg(args, "--account-id", payload.accountId);
    }
    if (payload.taskType === "mail_sync") {
      appendOptionalArg(args, "--account-id", payload.accountId);
      appendOptionalArg(args, "--source", payload.source ?? "auto");
      appendOptionalArg(args, "--limit", payload.limit ?? 20);
      if (payload.unreadOnly) args.push("--unread-only");
    }
    return runCliJson(args);
  });
  ipcMain.handle("app:saveSettings", async (_event, payload) => {
    const tempFile = path.join(os.tmpdir(), `outlook-batch-manager-settings-${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf-8");
    try {
      return runCliJson(["save-settings", "--file", tempFile]);
    } finally {
      await fs.rm(tempFile, { force: true });
    }
  });
  ipcMain.handle("app:importAccounts", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入账号",
      properties: ["openFile"],
      filters: [
        { name: "支持的文件", extensions: ["txt", "csv", "xlsx"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }
    return runCliJson(["import-accounts", "--file", result.filePaths[0]]);
  });
  ipcMain.handle("app:exportAccounts", async (_event, payload) => {
    const result = await dialog.showSaveDialog({
      title: "导出账号",
      defaultPath: "accounts-export.xlsx",
      filters: [
        { name: "Excel", extensions: ["xlsx"] },
        { name: "CSV", extensions: ["csv"] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }
    const args = ["export-accounts", "--file", result.filePath];
    appendOptionalArg(args, "--keyword", payload?.keyword);
    appendOptionalArg(args, "--status", payload?.status);
    return runCliJson(args);
  });
  ipcMain.handle("app:importProxies", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入代理",
      properties: ["openFile"],
      filters: [
        { name: "文本文件", extensions: ["txt"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }
    return runCliJson(["import-proxies", "--file", result.filePaths[0]]);
  });
  ipcMain.handle("app:createAccount", async (_event, payload) => {
    const args = [
      "create-account",
      "--email",
      payload.email,
      "--password",
      payload.password,
      "--provider",
      payload.provider,
      "--group",
      payload.groupName || "default",
      "--notes",
      payload.notes || "",
      "--recovery-email",
      payload.recoveryEmail || "",
      "--client-id-override",
      payload.clientIdOverride || "",
      "--refresh-token",
      payload.refreshToken || "",
    ];
    return runCliJson(args);
  });
  ipcMain.handle("app:testAccount", async (_event, accountId) => {
    return runCliJson(["test-account", "--account-id", String(accountId)]);
  });
  ipcMain.handle("app:syncMail", async (_event, payload) => {
    const args = ["sync-mail"];
    appendOptionalArg(args, "--account-id", payload?.accountId);
    appendOptionalArg(args, "--source", payload?.source ?? "auto");
    appendOptionalArg(args, "--limit", payload?.limit ?? 20);
    if (payload?.unreadOnly) args.push("--unread-only");
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
  ipcMain.handle("app:meta", async () => ({
    projectRoot,
    pythonExecutable: getPythonExecutable(),
  }));

  await createMainWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
