const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { join } = require("node:path");

async function findOpenPort(startPort = 8765) {
  let port = startPort;

  while (port < startPort + 100) {
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.on("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });

    if (available) {
      return port;
    }

    port += 1;
  }

  throw new Error("Unable to find an open port for the backend service.");
}

function createRuntimeConfig(userDataPath, port) {
  return {
    apiPort: port,
    apiBaseUrl: `http://127.0.0.1:${port}`,
    apiToken: randomBytes(24).toString("hex"),
    dataDir: join(userDataPath, "core-gateway-data")
  };
}

async function waitForBackend(baseUrl, apiToken, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          "X-Desktop-Token": apiToken
        }
      });

      if (response.ok) {
        return;
      }
    } catch (error) {
      void error;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("Timed out waiting for the local backend to become healthy.");
}

function startBackend({ projectRoot, runtimeConfig }) {
  const child = spawn(
    "python",
    [
      "-m",
      "uvicorn",
      "backend.app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(runtimeConfig.apiPort)
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        CORE_GATEWAY_PORT: String(runtimeConfig.apiPort),
        CORE_GATEWAY_TOKEN: runtimeConfig.apiToken,
        CORE_GATEWAY_DATA_DIR: runtimeConfig.dataDir
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[backend] ${chunk}`);
  });

  return child;
}

function stopBackend(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill();
}

module.exports = {
  createRuntimeConfig,
  findOpenPort,
  startBackend,
  stopBackend,
  waitForBackend
};

