import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 240_000,
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: existsSync(systemChrome) ? { executablePath: systemChrome } : {},
  },
});
