import { expect, test } from "@playwright/test";

test("local role surfaces expose the documented recovery boundary", async ({ page }) => {
  await page.goto("/order/demo");
  await expect(page.getByRole("heading", { name: "Welcome to DIVE" })).toBeVisible();
  await expect(page.getByText("Final price, tax, service, and availability are confirmed on submission.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit order" })).toBeDisabled();
});

test("KDS surface hides operational data until staff authorization", async ({ page }) => {
  const healthResponse = page.waitForResponse((response) => response.url().endsWith("/api/health"));
  await page.goto("/kds");
  await healthResponse;
  await expect(page.getByRole("heading", { name: "Pass, without the panic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to operate Kitchen" })).toBeVisible();
  await expect(page.getByRole("status").getByText("App reachable")).toBeVisible();
  await expect(page.getByText("Wok Station")).toHaveCount(0);
  await expect(page.getByText("Nasi Lemak DIVE")).toHaveCount(0);
});

test("staff role pages do not disclose repository snapshots before sign-in", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "staff-desktop", "Staff authorization boundary smoke runs in the staff project only.");
  await page.goto("/waiter");
  await expect(page.getByRole("heading", { name: "Sign in to operate Waiter" })).toBeVisible();
  await expect(page.getByText("T99 synthetic")).toHaveCount(0);
  await page.goto("/cashier");
  await expect(page.getByRole("heading", { name: "Sign in to operate Cashier" })).toBeVisible();
  await expect(page.getByText("Nasi Lemak DIVE")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Sign in to operate Admin" })).toBeVisible();
  await expect(page.getByText(/visible items/)).toHaveCount(0);
});

test("customer join boundary is keyboard addressable without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/order/demo");
  await expect(page.getByRole("button", { name: "Join table" })).toBeEnabled();
  const joinCode = page.getByLabel("Join Code");
  await joinCode.focus();
  await expect(joinCode).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("public menu API reads the synthetic local Supabase seed", async ({ request }) => {
  const response = await request.get("/api/v1/customer/menu?restaurantSlug=dive-demo&branchSlug=main");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.meta.source).toBe("supabase");
  expect(body.meta.environment).toBe("local");
  expect(body.meta.productionConnected).toBe(false);
  expect(body.data.items).toHaveLength(2);
  expect(body.data.items[0].category).toBe("Mains");
});

test("staff menu mutation rejects malformed commands before authentication", async ({ request }) => {
  const response = await request.post("/api/v1/staff/menu/items/00000000-0000-4000-8000-000000000401/availability", { data: { available: "nope" } });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("staff menu mutation rejects unauthenticated writes", async ({ request }) => {
  const response = await request.post("/api/v1/staff/menu/items/00000000-0000-4000-8000-000000000401/availability", {
    data: { available: false, expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000707" },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("staff Session open rejects malformed commands before authentication", async ({ request }) => {
  const response = await request.post("/api/v1/staff/sessions", { data: { tableId: "not-a-uuid", guestCount: 2 } });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("staff Session open rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/staff/sessions", {
    data: { tableId: "00000000-0000-4000-8000-000000000601", guestCount: 2, idempotencyKey: "00000000-0000-4000-8000-000000000701" },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("customer Session join rejects malformed commands before authentication", async ({ request }) => {
  const response = await request.post("/api/v1/customer/sessions/join", { data: { sessionId: "not-a-uuid", joinCode: "12" } });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("customer Session join rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/customer/sessions/join", { data: { sessionId: "00000000-0000-4000-8000-000000009301", joinCode: "123456" } });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("customer service request rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/customer/service-requests", { data: { sessionId: "00000000-0000-4000-8000-000000009402", requestType: "WATER", idempotencyKey: "00000000-0000-4000-8000-000000000801" } });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("waiter service request transition rejects malformed commands before authentication", async ({ request }) => {
  const response = await request.post("/api/v1/staff/service-requests/00000000-0000-4000-8000-000000009501/transition", { data: { nextState: "BROKEN" } });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("VALIDATION_ERROR");
});

test("KDS transition rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/staff/kds/items/00000000-0000-4000-8000-000000009601/transition", { data: { nextState: "PREPARING", expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000901" } });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("cashier payment confirmation rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/staff/payments/00000000-0000-4000-8000-000000009804/confirm", { data: { cashReceivedMinor: 2000, idempotencyKey: "00000000-0000-4000-8000-000000000902" } });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("branch report rejects unauthenticated reads", async ({ request }) => {
  const response = await request.get("/api/v1/staff/reports/branch-summary?branchId=00000000-0000-4000-8000-000000000002");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});

test("customer order submission rejects unauthenticated commands", async ({ request }) => {
  const response = await request.post("/api/v1/customer/orders", { data: { sessionId: "00000000-0000-4000-8000-000000009912", items: [{ menuItemId: "00000000-0000-4000-8000-000000000401", quantity: 1, modifierOptionIds: [] }], idempotencyKey: "00000000-0000-4000-8000-000000000903", expectedSessionVersion: 1 } });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("UNAUTHORIZED");
});
