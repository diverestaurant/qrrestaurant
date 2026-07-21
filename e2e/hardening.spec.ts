import { expect, test } from "@playwright/test";
import { source as axeSource } from "axe-core";

const roleRoutes = ["/kds", "/waiter", "/cashier", "/admin"];

test.describe("local M10 browser hardening", () => {
  test("critical public and staff-auth surfaces have no automated WCAG A/AA violations", async ({ page }) => {
    for (const route of ["/order/demo", ...roleRoutes]) {
      await page.goto(route);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const axe = (window as typeof window & { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: Array<{ failureSummary?: string; html: string; target: string[] }> }> }> } }).axe;
        const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
        return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ failureSummary: node.failureSummary, html: node.html, target: node.target })) }));
      });
      expect(violations, `${route} accessibility violations`).toEqual([]);
    }
  });

  test("role surfaces remain usable at narrow mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });

    for (const route of ["/order/demo", ...roleRoutes]) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} has horizontal overflow`).toBe(true);
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("critical role actions have accessible names and visible focus", async ({ page }) => {
    await page.goto("/order/demo");
    await expect(page.getByRole("button", { name: "Join table" })).toBeEnabled();
    await page.getByLabel("Join Code").focus();
    await expect(page.getByLabel("Join Code")).toBeFocused();
    await expect(page.getByRole("button", { name: "Submit order" })).toBeVisible();

    await page.goto("/kds");
    await expect(page.getByRole("heading", { name: "Sign in to operate Kitchen" })).toBeVisible();
    await expect(page.getByLabel("Staff email")).toBeVisible();

    await page.goto("/waiter");
    await expect(page.getByRole("heading", { name: "Sign in to operate Waiter" })).toBeVisible();
    await expect(page.getByLabel("Staff email")).toBeVisible();
  });

  test("local menu response stays within the smoke latency budget", async ({ request }) => {
    const started = Date.now();
    const response = await request.get("/api/v1/customer/menu?restaurantSlug=dive-demo&branchSlug=main");
    const elapsedMs = Date.now() - started;
    expect(response.ok()).toBe(true);
    expect(elapsedMs).toBeLessThan(3000);
  });

  test("visible recovery status moves offline and confirms the app after reconnect", async ({ page }) => {
    const healthResponse = page.waitForResponse((response) => response.url().endsWith("/api/health"));
    await page.goto("/waiter");
    await healthResponse;
    await expect(page.getByRole("status").getByText("App reachable")).toBeVisible();

    await page.context().setOffline(true);
    await expect(page.getByRole("status").getByText("Offline")).toBeVisible();

    await page.context().setOffline(false);
    await expect(page.getByRole("status").getByText("App reachable")).toBeVisible();
  });
});
