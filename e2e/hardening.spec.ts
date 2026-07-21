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

  test("readiness reports the application and local database without exposing internals", async ({ request }) => {
    const response = await request.get("/api/health?check=readiness");
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-correlation-id"]).toMatch(/[0-9a-f-]{36}/);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, service: "dive-restaurant", mode: "local", checks: { application: "ok", database: "ok" } });
    expect(body.durationMs).toBeLessThan(1200);
    expect(JSON.stringify(body)).not.toMatch(/password|service.?role|authorization|postgres:/i);
  });

  test("application responses carry the reviewed browser security headers", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["permissions-policy"]).toContain("payment=()");
    expect(response.headers()["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers()["strict-transport-security"]).toBe("max-age=31536000");
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
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
