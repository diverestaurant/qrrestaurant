import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Synthetic local fixtures share deterministic IDs across role projects;
  // database-level concurrency is covered by pgTAP, while browser flows run
  // serially to avoid cross-project fixture races.
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.SKIP_WEBSERVER ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "customer-mobile", use: { ...devices["Pixel 5"] } },
    { name: "staff-desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
