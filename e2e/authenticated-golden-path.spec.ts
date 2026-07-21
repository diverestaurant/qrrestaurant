import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

loadEnvConfig(process.cwd());

const baseUrl = "http://127.0.0.1:3000";
const sessionId = "00000000-0000-4000-8000-000000000701";

async function signInSyntheticAnonymousCustomer(page: Page) {
  const cookies = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session || !data.user?.is_anonymous) throw error ?? new Error("Synthetic anonymous sign-in did not return an anonymous session.");
  await page.context().addCookies([...cookies].map(([name, value]) => ({ name, value, url: baseUrl })));
  return { accessToken: data.session.access_token };
}

async function readSessionVersion(accessToken: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.from("dining_sessions").select("version").eq("id", sessionId).single();
  if (error || !data) throw error ?? new Error("Synthetic customer could not read its joined Session.");
  return data.version;
}

async function apiJson(page: Page, path: string, init: { method: "POST"; body: unknown }) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { method: init.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) });
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "customer-mobile", "Customer Auth flow is verified in the mobile customer project only.");
});

test("synthetic anonymous customer can join, submit and replay an order", async ({ page }) => {
  await page.goto("/");
  const auth = await signInSyntheticAnonymousCustomer(page);

  const join = await apiJson(page, "/api/v1/customer/sessions/join", { method: "POST", body: { sessionId, joinCode: "123456" } });
  expect(join.status, JSON.stringify(join.body)).toBe(200);
  expect(join.body.ok).toBe(true);
  expect(join.body.data.grantId).toMatch(/[0-9a-f-]{36}/);

  const orderBody = {
    sessionId,
    items: [{ menuItemId: "00000000-0000-4000-8000-000000000401", quantity: 1, modifierOptionIds: [] }],
    idempotencyKey: randomUUID(),
    expectedSessionVersion: await readSessionVersion(auth.accessToken),
  };
  const first = await apiJson(page, "/api/v1/customer/orders", { method: "POST", body: orderBody });
  expect(first.status).toBe(200);
  expect(first.body.ok).toBe(true);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data.orderId).toMatch(/[0-9a-f-]{36}/);

  const replay = await apiJson(page, "/api/v1/customer/orders", { method: "POST", body: orderBody });
  expect(replay.status).toBe(200);
  expect(replay.body.ok).toBe(true);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data.orderId).toBe(first.body.data.orderId);
});

test("synthetic anonymous customer can create and replay a service request", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticAnonymousCustomer(page);
  const join = await apiJson(page, "/api/v1/customer/sessions/join", { method: "POST", body: { sessionId, joinCode: "123456" } });
  expect(join.status, JSON.stringify(join.body)).toBe(200);

  const body = { sessionId, requestType: "WATER", note: "Synthetic local request", idempotencyKey: randomUUID() };
  const first = await apiJson(page, "/api/v1/customer/service-requests", { method: "POST", body });
  expect(first.status).toBe(200);
  expect(first.body.meta.replay).toBe(false);
  const replay = await apiJson(page, "/api/v1/customer/service-requests", { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data.requestId).toBe(first.body.data.requestId);
});

test("synthetic anonymous customer can complete the customer UI flow", async ({ page }) => {
  await page.goto("/order/demo");
  await page.getByLabel("Join Code").fill("123456");
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByRole("button", { name: "Table joined" })).toBeVisible();
  await expect(page.getByText("Live updates: connected", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Add Nasi Lemak DIVE to order" }).click();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(page.getByText("Order sent.")).toBeVisible();
  await expect(page.getByText(/Order #\d+/).first()).toBeVisible();

  await page.getByRole("button", { name: "Ask for water" }).click();
  await expect(page.getByText("Request sent to the team.")).toBeVisible();
});

test("customer Realtime notification triggers an authoritative resync", async ({ page }) => {
  await page.goto("/order/demo");
  await page.getByLabel("Join Code").fill("123456");
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByText("Live updates: connected", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const summary = page.locator("p").filter({ hasText: /\d+ request/ }).first();
  const beforeText = await summary.textContent();
  const beforeCount = Number(beforeText?.match(/(\d+) request/)?.[1] ?? 0);

  const result = await page.evaluate(async ({ sessionId, idempotencyKey }) => {
    const response = await fetch("/api/v1/customer/service-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, requestType: "OTHER", note: "Realtime resync smoke", idempotencyKey }) });
    return { status: response.status, body: await response.json() };
  }, { sessionId, idempotencyKey: randomUUID() });
  expect(result.status).toBe(200);
  await expect.poll(async () => Number((await summary.textContent())?.match(/(\d+) request/)?.[1] ?? 0), { timeout: 10_000 }).toBe(beforeCount + 1);
});

test("customer UI keeps configured variant and modifier lines separate", async ({ page }) => {
  await page.goto("/order/demo");
  await page.getByRole("button", { name: "Customize Nasi Lemak DIVE" }).click();
  await page.locator('input[type="radio"][name="variant-00000000-0000-4000-8000-000000000401"]').last().check();
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "Add customized item" }).click();
  await expect(page.getByText(/Extra spicy · Fried egg/)).toBeVisible();
  await expect(page.getByText(/19\.80/).first()).toBeVisible();
});

test("synthetic QR entry resolves public table context before Join Code", async ({ page }) => {
  await page.goto("/order/dive-demo/main/local-table-token");
  await expect(page.getByRole("heading", { name: "Welcome to DIVE Restaurant Demo" })).toBeVisible();
  await expect(page.getByText("T99 synthetic").first()).toBeVisible();
  await expect(page.getByText("Browse freely; enter the current Join Code")).toBeVisible();
  await page.getByLabel("Join Code").fill("123456");
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByRole("button", { name: "Table joined" })).toBeVisible();
});
