const test = require("node:test");
const assert = require("node:assert/strict");

const { createRuntimeConfig, findOpenPort } = require("./backend-manager");

test("createRuntimeConfig returns a local backend shape", () => {
  const runtime = createRuntimeConfig("C:\\Temp\\CoreGateway", 9123);

  assert.equal(runtime.apiPort, 9123);
  assert.equal(runtime.apiBaseUrl, "http://127.0.0.1:9123");
  assert.match(runtime.apiToken, /^[a-f0-9]{48}$/);
  assert.ok(runtime.dataDir.endsWith("core-gateway-data"));
});

test("findOpenPort resolves an available local port", async () => {
  const port = await findOpenPort(9300);

  assert.equal(typeof port, "number");
  assert.ok(port >= 9300);
});

