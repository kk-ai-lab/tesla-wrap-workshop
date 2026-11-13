import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-dev",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4177" },
  webServer: {
    command: "node ./node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4177 --ignore-lock",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
