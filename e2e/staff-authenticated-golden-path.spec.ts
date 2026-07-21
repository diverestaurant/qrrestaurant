import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

loadEnvConfig(process.cwd());

const baseUrl = "http://127.0.0.1:3000";
const branchId = "00000000-0000-4000-8000-000000000002";
const restaurantId = "00000000-0000-4000-8000-000000000001";
const managerRoleId = "00000000-0000-4000-8000-000000000103";
const ownerRoleId = "00000000-0000-4000-8000-000000000102";
const platformRoleId = "00000000-0000-4000-8000-000000000101";
const kitchenRoleId = "00000000-0000-4000-8000-000000000104";
const menuItemId = "00000000-0000-4000-8000-000000000403";
const tableId = "00000000-0000-4000-8000-000000000601";
const adminBranchId = branchId;
const seededOrderItemId = "00000000-0000-4000-8000-000000000704";
const seededServiceRequestId = "00000000-0000-4000-8000-000000000705";
const seededPaymentId = "00000000-0000-4000-8000-000000000706";

async function createSyntheticStaffAccount(roleId = managerRoleId) {
  const email = `synthetic-manager-${randomUUID()}@local.test`;
  const password = `local-only-${randomUUID()}`;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Synthetic staff user was not created.");
  const membership = await admin.from("staff_memberships").insert({ id: randomUUID(), user_id: created.data.user.id, restaurant_id: restaurantId, branch_id: branchId, role_id: roleId, status: "ACTIVE" });
  if (membership.error) throw membership.error;
  return { admin, email, password, userId: created.data.user.id };
}

async function signInSyntheticStaff(page: Page, roleId = managerRoleId) {
  const account = await createSyntheticStaffAccount(roleId);
  const { email, password } = account;

  const cookies = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Synthetic staff sign-in did not return a session.");
  await page.context().addCookies([...cookies].map(([name, value]) => ({ name, value, url: baseUrl })));
  return { ...account, accessToken: signedIn.data.session.access_token };
}

async function apiJson(page: Page, path: string, init: { method: "POST"; body: unknown }) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { method: init.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) });
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

async function getJson(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  }, path);
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "staff-desktop", "Staff Auth flow is verified in the desktop staff project only.");
});

test("synthetic manager can update menu availability and replay the command", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const body = { available: false, expectedVersion: 1, idempotencyKey: randomUUID() };
  const first = await apiJson(page, `/api/v1/staff/menu/items/${menuItemId}/availability`, { method: "POST", body });
  expect(first.status).toBe(200);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data.available).toBe(false);
  expect(first.body.data.version).toBe(2);
  const replay = await apiJson(page, `/api/v1/staff/menu/items/${menuItemId}/availability`, { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data).toEqual(first.body.data);
});

test("synthetic manager can open a Session and replay the command", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const body = { tableId, guestCount: 2, idempotencyKey: randomUUID() };
  const first = await apiJson(page, "/api/v1/staff/sessions", { method: "POST", body });
  expect(first.status).toBe(201);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data.sessionId).toMatch(/[0-9a-f-]{36}/);
  expect(first.body.data.joinCode).toMatch(/^\d{6}$/);
  const replay = await apiJson(page, "/api/v1/staff/sessions", { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data.sessionId).toBe(first.body.data.sessionId);
});

test("synthetic manager can transition a kitchen item and replay the command", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const body = { nextState: "ACCEPTED", expectedVersion: 1, idempotencyKey: randomUUID() };
  const first = await apiJson(page, `/api/v1/staff/kds/items/${seededOrderItemId}/transition`, { method: "POST", body });
  expect(first.status).toBe(200);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data).toEqual({ version: 2, state: "ACCEPTED" });
  const replay = await apiJson(page, `/api/v1/staff/kds/items/${seededOrderItemId}/transition`, { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data).toEqual(first.body.data);
});

test("synthetic manager can transition a service request and replay the command", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const body = { nextState: "CLAIMED", expectedVersion: 1, idempotencyKey: randomUUID() };
  const first = await apiJson(page, `/api/v1/staff/service-requests/${seededServiceRequestId}/transition`, { method: "POST", body });
  expect(first.status).toBe(200);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data).toEqual({ version: 2, state: "CLAIMED" });
  const replay = await apiJson(page, `/api/v1/staff/service-requests/${seededServiceRequestId}/transition`, { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data).toEqual(first.body.data);
});

test("synthetic manager can confirm a cash payment and replay the command", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const body = { cashReceivedMinor: 2000, idempotencyKey: randomUUID() };
  const first = await apiJson(page, `/api/v1/staff/payments/${seededPaymentId}/confirm`, { method: "POST", body });
  expect(first.status).toBe(200);
  expect(first.body.meta.replay).toBe(false);
  expect(first.body.data).toEqual({ paymentId: seededPaymentId, state: "CONFIRMED", changeMinor: 320 });
  const replay = await apiJson(page, `/api/v1/staff/payments/${seededPaymentId}/confirm`, { method: "POST", body });
  expect(replay.status).toBe(200);
  expect(replay.body.meta.replay).toBe(true);
  expect(replay.body.data).toEqual(first.body.data);
});

test("synthetic manager can complete discount, multi-tender, receipt and close recovery", async ({ page }) => {
  await page.goto("/");
  const auth = await signInSyntheticStaff(page);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const financeTableId = randomUUID();
  const financeTableLabel = `F-${financeTableId.slice(0, 6)}`;
  const financeSessionId = randomUUID();
  const cleanup = async () => {
    await admin.from("customer_session_grants").delete().eq("session_id", financeSessionId);
    await admin.from("payment_allocations").delete().eq("session_id", financeSessionId);
    await admin.from("payments").delete().eq("session_id", financeSessionId);
    await admin.from("discounts").delete().eq("session_id", financeSessionId);
    await admin.from("receipts").delete().eq("session_id", financeSessionId);
    await admin.from("dining_sessions").delete().eq("id", financeSessionId);
    await admin.from("restaurant_tables").delete().eq("id", financeTableId);
  };
  const table = await admin.from("restaurant_tables").insert({ id: financeTableId, restaurant_id: restaurantId, branch_id: branchId, label: financeTableLabel, capacity: 2, active: true });
  if (table.error) throw table.error;
  const seeded = await admin.from("dining_sessions").insert({ id: financeSessionId, restaurant_id: restaurantId, branch_id: branchId, table_id: financeTableId, state: "OPEN", guest_count: 2, business_date: new Date().toISOString().slice(0, 10), total_due_minor: 3000, currency: "MYR" });
  if (seeded.error) throw seeded.error;
  try {
    const discount = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/discounts`, { method: "POST", body: { kind: "PERCENT", percentageBasisPoints: 1000, reason: "Synthetic manager authorization", expectedSessionVersion: 1, idempotencyKey: randomUUID() } });
    expect(discount.status).toBe(201);
    expect(discount.body.data).toMatchObject({ discountMinor: 300, totalDueMinor: 2700, version: 2 });

    const firstPayment = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/payments`, { method: "POST", body: { amountMinor: 1000, currency: "MYR", method: "CASH", expectedSessionVersion: 2, idempotencyKey: randomUUID() } });
    expect(firstPayment.status).toBe(201);
    const firstConfirmation = await apiJson(page, `/api/v1/staff/payments/${firstPayment.body.data.paymentId}/confirm`, { method: "POST", body: { cashReceivedMinor: 1200, idempotencyKey: randomUUID() } });
    expect(firstConfirmation.status).toBe(200);
    expect(firstConfirmation.body.data.changeMinor).toBe(200);

    const secondPayment = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/payments`, { method: "POST", body: { amountMinor: 1700, currency: "MYR", method: "CARD", expectedSessionVersion: 4, idempotencyKey: randomUUID() } });
    expect(secondPayment.status).toBe(201);
    const secondConfirmation = await apiJson(page, `/api/v1/staff/payments/${secondPayment.body.data.paymentId}/confirm`, { method: "POST", body: { observedReference: "SYNTHETIC-CARD-001", idempotencyKey: randomUUID() } });
    expect(secondConfirmation.status).toBe(200);

    const receipt = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/receipt`, { method: "POST", body: { idempotencyKey: randomUUID() } });
    expect(receipt.status).toBe(201);
    expect(receipt.body.data.receiptNumber).toMatch(/^\d{8}-\d{6}$/);
    expect(receipt.body.data.snapshot).toMatchObject({ snapshotVersion: 1, tableLabel: financeTableLabel, restaurant: { name: "DIVE Restaurant Demo" }, branch: { name: "DIVE Demo Branch" }, totalDueMinor: 2700, totalPaidMinor: 2700 });
    await page.goto(`/cashier/receipts/${receipt.body.data.receiptId}/print`);
    await expect(page.getByText("Immutable receipt snapshot")).toBeVisible();
    await expect(page.getByRole("heading", { name: "DIVE Restaurant Demo" })).toBeVisible();
    await expect(page.getByText(`Receipt ${receipt.body.data.receiptNumber}`)).toBeVisible();
    await expect(page.getByText("Table", { exact: true }).locator("..")).toContainText(financeTableLabel);
    await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    const closeBody = { expectedSessionVersion: 6, idempotencyKey: randomUUID() };
    const close = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/close`, { method: "POST", body: closeBody });
    expect(close.status).toBe(200);
    expect(close.body.data.state).toBe("CLOSED");
    const replay = await apiJson(page, `/api/v1/staff/sessions/${financeSessionId}/close`, { method: "POST", body: closeBody });
    expect(replay.status).toBe(200);
    expect(replay.body.meta.replay).toBe(true);
  } finally {
    await cleanup();
  }
  expect(auth.accessToken).toMatch(/^.+\..+\..+$/);
});

test("synthetic manager can read a branch summary through the authorized report boundary", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);
  const report = await getJson(page, `/api/v1/staff/reports/branch-summary?branchId=${adminBranchId}`);
  expect(report.status).toBe(200);
  expect(report.body.ok).toBe(true);
  expect(report.body.meta.freshness).toBe("fresh");
  expect(report.body.data.branchId).toBe(adminBranchId);
  expect(report.body.data.branchName).toBe("DIVE Demo Branch");
  const today = new Date().toISOString().slice(0, 10);
  const operations = await getJson(page, `/api/v1/staff/reports/operations?branchId=${adminBranchId}&from=${today}&to=${today}`);
  expect(operations.status).toBe(200);
  expect(operations.body.ok).toBe(true);
  expect(operations.body.data).toMatchObject({ branchId: adminBranchId, branchName: "DIVE Demo Branch", timezone: "Asia/Kuching", currency: "MYR" });
  expect(operations.body.data.orders).toBeGreaterThanOrEqual(1);
  expect(operations.body.data.reconciliationExceptions).toBeInstanceOf(Array);
});

test("staff sign-in form refreshes into an authorized server snapshot", async ({ page }) => {
  const account = await createSyntheticStaffAccount();
  try {
    await page.goto("/kds");
    await page.getByLabel("Staff email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(`Signed in as ${account.email}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Wok Station" })).toBeVisible();
  } finally {
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("synthetic manager can operate the KDS, waiter and admin UI gates", async ({ page }) => {
  await page.goto("/");
  await signInSyntheticStaff(page);

  await page.goto("/kds");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  const kitchenAction = page.getByRole("button", { name: /Move to/ }).first();
  await expect(kitchenAction).toBeVisible();
  await kitchenAction.click();
  await expect(page.getByText(/Committed order item · version/).first()).toBeVisible();

  await page.goto("/waiter");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open, hand off, or reset a table Session" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build an order from the live menu" })).toBeVisible();
  const waiterAction = page.getByRole("button", { name: /Claim|Resolve/ }).first();
  await expect(waiterAction).toBeVisible();
  await waiterAction.click();

  await page.goto("/admin");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Mark (available|sold out)/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Load branch report" }).click();
  await expect(page.getByText(/active tables/)).toBeVisible();
  await page.getByRole("button", { name: "Load operations report" }).click();
  await expect(page.getByLabel("Operations report")).toBeVisible();
  await expect(page.getByText(/Asia\/Kuching · MYR/)).toBeVisible();

  await page.goto("/cashier");
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Select Session" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complete the bill" })).toBeVisible();
});

test("Admin UI commits menu, table, QR, station and feature-flag operations", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page);
  const suffix = randomUUID().slice(0, 6);
  const categoryName = `Admin E2E ${suffix}`;
  const itemName = `Repository Item ${suffix}`;
  const tableLabel = `A-${suffix}`;
  const stationKey = `s${suffix}`;
  const stationName = `Station ${suffix}`;
  const flagKey = `e2e.${suffix}`;

  try {
    await page.goto("/admin");
    await page.getByLabel("New category").fill(categoryName);
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByRole("option", { name: categoryName })).toHaveCount(1);

    await page.getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: categoryName });
    await page.getByLabel("New item name").fill(itemName);
    const menuPanel = page.getByRole("heading", { name: "Menu and categories" }).locator("..");
    await menuPanel.getByLabel("Price (MYR)").first().fill("12.50");
    await page.getByRole("button", { name: "Create item" }).click();
    await expect(page.locator(`input[value="${itemName}"]`)).toBeVisible();

    const tablesPanel = page.getByRole("heading", { name: "Tables and secure QR" }).locator("..");
    await tablesPanel.getByLabel("New table label").fill(tableLabel);
    await tablesPanel.getByLabel("New table area").fill("E2E floor");
    await tablesPanel.getByLabel("New table capacity").fill("3");
    await tablesPanel.getByRole("button", { name: "Create table" }).click();
    const tableRow = page.getByRole("group", { name: `Table ${tableLabel}` });
    await expect(tableRow).toBeVisible();
    await tableRow.getByRole("button", { name: "Rotate QR" }).click();
    await expect(page.getByText(new RegExp(`One-time Table Entry QR for ${tableLabel}`))).toBeVisible();
    const qrImage = page.getByRole("img", { name: `Table Entry QR for ${tableLabel}` });
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.getByRole("button", { name: "Print Table QR" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print Table QR" })).toBeHidden();
    await expect(qrImage).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    const stationPanel = page.getByRole("heading", { name: "Kitchen stations" }).locator("..");
    await stationPanel.getByLabel("Key").fill(stationKey);
    await stationPanel.getByLabel("Name").fill(stationName);
    await stationPanel.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator(`input[value="${stationName}"]`)).toBeVisible();

    const flagPanel = page.getByRole("heading", { name: "Basic feature flags" }).locator("..");
    await flagPanel.getByLabel("Flag key").fill(flagKey);
    await flagPanel.getByLabel("Description").fill("Synthetic UI verification flag");
    await flagPanel.getByRole("button", { name: "Create disabled flag" }).click();
    await expect(page.getByText(flagKey, { exact: true })).toBeVisible();

    const qr = await account.admin.from("restaurant_tables").select("id").eq("branch_id", branchId).eq("label", tableLabel).single();
    if (qr.error) throw qr.error;
    const token = await account.admin.from("table_qr_tokens").select("token_hash,active").eq("table_id", qr.data.id).single();
    if (token.error) throw token.error;
    expect(token.data.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.data.active).toBe(true);
  } finally {
    const table = await account.admin.from("restaurant_tables").select("id").eq("branch_id", branchId).eq("label", tableLabel).maybeSingle();
    if (table.data) {
      await account.admin.from("table_qr_tokens").delete().eq("table_id", table.data.id);
      await account.admin.from("restaurant_tables").delete().eq("id", table.data.id);
    }
    await account.admin.from("menu_items").delete().eq("branch_id", branchId).eq("name", itemName);
    await account.admin.from("menu_categories").delete().eq("branch_id", branchId).eq("name", categoryName);
    await account.admin.from("kitchen_stations").delete().eq("branch_id", branchId).eq("station_key", stationKey);
    await account.admin.from("feature_flags").delete().eq("branch_id", branchId).eq("flag_key", flagKey);
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("Owner UI commits and restores Restaurant and Branch settings", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page, ownerRoleId);
  const [restaurant, restaurantSettings, branch, branchSettings] = await Promise.all([
    account.admin.from("restaurants").select("name,default_currency,default_timezone,version").eq("id", restaurantId).single(),
    account.admin.from("restaurant_settings").select("legal_name,registration_number,tax_registration_number,contact_phone,contact_email,brand_accent,receipt_footer,version").eq("restaurant_id", restaurantId).single(),
    account.admin.from("branches").select("name,currency,timezone,business_day_cutoff,version").eq("id", branchId).single(),
    account.admin.from("branch_settings").select("default_locale,address_line_1,address_line_2,city,postal_code,country_code,contact_phone,contact_email,version").eq("branch_id", branchId).single(),
  ]);
  if (restaurant.error || restaurantSettings.error || branch.error || branchSettings.error) throw restaurant.error ?? restaurantSettings.error ?? branch.error ?? branchSettings.error;

  try {
    await page.goto("/admin");
    await expect(page.getByRole("group", { name: "Restaurant profile · Owner only" })).toBeEnabled();
    await page.getByLabel("Legal name").fill("Synthetic Owner Verification");
    await page.getByLabel("Receipt footer").fill("Synthetic owner receipt footer");
    await page.getByRole("button", { name: "Save Restaurant profile" }).click();
    await expect.poll(async () => {
      const result = await account.admin.from("restaurant_settings").select("legal_name,receipt_footer").eq("restaurant_id", restaurantId).single();
      return result.data;
    }).toEqual({ legal_name: "Synthetic Owner Verification", receipt_footer: "Synthetic owner receipt footer" });

    const branchSettingsGroup = page.getByRole("group", { name: "Branch operations" });
    await branchSettingsGroup.getByLabel("Address line 1").fill("Synthetic branch address");
    await branchSettingsGroup.getByLabel("City", { exact: true }).fill("Synthetic Kuching");
    await branchSettingsGroup.getByRole("button", { name: "Save Branch settings" }).click();
    await expect.poll(async () => {
      const result = await account.admin.from("branch_settings").select("address_line_1,city").eq("branch_id", branchId).single();
      return result.data;
    }).toEqual({ address_line_1: "Synthetic branch address", city: "Synthetic Kuching" });
  } finally {
    const [currentRestaurant, currentRestaurantSettings, currentBranch, currentBranchSettings] = await Promise.all([
      account.admin.from("restaurants").select("version").eq("id", restaurantId).single(),
      account.admin.from("restaurant_settings").select("version").eq("restaurant_id", restaurantId).single(),
      account.admin.from("branches").select("version").eq("id", branchId).single(),
      account.admin.from("branch_settings").select("version").eq("branch_id", branchId).single(),
    ]);
    if (currentRestaurant.data && currentRestaurantSettings.data && (currentRestaurant.data.version !== restaurant.data.version || currentRestaurantSettings.data.version !== restaurantSettings.data.version)) {
      await apiJson(page, "/api/v1/staff/admin/commands", { method: "POST", body: { type: "restaurant.settings.update", restaurantId, branchId, idempotencyKey: randomUUID(), expectedRestaurantVersion: currentRestaurant.data.version, expectedSettingsVersion: currentRestaurantSettings.data.version, name: restaurant.data.name, defaultCurrency: restaurant.data.default_currency, defaultTimezone: restaurant.data.default_timezone, legalName: restaurantSettings.data.legal_name ?? "", registrationNumber: restaurantSettings.data.registration_number ?? "", taxRegistrationNumber: restaurantSettings.data.tax_registration_number ?? "", contactPhone: restaurantSettings.data.contact_phone ?? "", contactEmail: restaurantSettings.data.contact_email ?? "", brandAccent: restaurantSettings.data.brand_accent ?? "#0F766E", receiptFooter: restaurantSettings.data.receipt_footer ?? "" } });
    }
    if (currentBranch.data && currentBranchSettings.data && (currentBranch.data.version !== branch.data.version || currentBranchSettings.data.version !== branchSettings.data.version)) {
      await apiJson(page, "/api/v1/staff/admin/commands", { method: "POST", body: { type: "branch.settings.update", restaurantId, branchId, idempotencyKey: randomUUID(), expectedBranchVersion: currentBranch.data.version, expectedSettingsVersion: currentBranchSettings.data.version, name: branch.data.name, currency: branch.data.currency, timezone: branch.data.timezone, businessDayCutoff: String(branch.data.business_day_cutoff).slice(0, 5), defaultLocale: branchSettings.data.default_locale, addressLine1: branchSettings.data.address_line_1 ?? "", addressLine2: branchSettings.data.address_line_2 ?? "", city: branchSettings.data.city ?? "", postalCode: branchSettings.data.postal_code ?? "", countryCode: branchSettings.data.country_code, contactPhone: branchSettings.data.contact_phone ?? "", contactEmail: branchSettings.data.contact_email ?? "" } });
    }
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("Platform UI creates, replays, suspends and reactivates an isolated tenant", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page, platformRoleId);
  const suffix = randomUUID().slice(0, 8);
  const tenantName = `Synthetic Platform ${suffix}`;
  const createCommand = {
    type: "platform.restaurant.create",
    name: tenantName,
    slug: `synthetic-platform-${suffix}`,
    defaultCurrency: "MYR",
    defaultTimezone: "Asia/Kuching",
    branchName: `Synthetic Branch ${suffix}`,
    branchSlug: "main",
    planKey: "MANUAL_V1",
    idempotencyKey: randomUUID(),
  };

  try {
    const first = await apiJson(page, "/api/v1/platform/tenants", { method: "POST", body: createCommand });
    expect(first.status).toBe(201);
    expect(first.body.meta.replay).toBe(false);
    expect(first.body.data.version).toBe(1);

    const replay = await apiJson(page, "/api/v1/platform/tenants", { method: "POST", body: createCommand });
    expect(replay.status).toBe(200);
    expect(replay.body.meta.replay).toBe(true);
    expect(replay.body.data).toEqual(first.body.data);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Restaurant lifecycle and manual subscription tracking" })).toBeVisible();
    await page.getByRole("button", { name: "Load platform tenants" }).click();
    const tenant = page.locator("article").filter({ has: page.getByRole("heading", { name: tenantName, exact: true }) });
    const tenantStatus = tenant.getByLabel(`${tenantName} tenant status`);
    await expect(tenantStatus).toHaveText("ACTIVE");
    await tenant.getByRole("button", { name: "Suspend access" }).click();
    await expect(tenantStatus).toHaveText("SUSPENDED");
    await tenant.getByRole("button", { name: "Reactivate access" }).click();
    await expect(tenantStatus).toHaveText("ACTIVE");
    await tenant.getByLabel("Manual plan key").fill("E2E_MANUAL");
    await tenant.getByLabel("Subscription status").selectOption("ACTIVE");
    await tenant.getByRole("button", { name: "Save tracking" }).click();
    await expect.poll(async () => {
      const catalog = await getJson(page, "/api/v1/platform/tenants");
      expect(catalog.status).toBe(200);
      return catalog.body.data.find((entry: { restaurantId: string }) => entry.restaurantId === first.body.data.restaurantId);
    }).toMatchObject({ restaurantId: first.body.data.restaurantId, status: "ACTIVE", subscription: { planKey: "E2E_MANUAL", status: "ACTIVE", version: 4 } });
  } finally {
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("Owner UI creates, replays, suspends and reactivates a Branch", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page, ownerRoleId);
  const suffix = randomUUID().slice(0, 8);
  const branchName = `Synthetic Owner Branch ${suffix}`;
  try {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Branches and lifecycle" })).toBeVisible();
    const lifecycle = page.getByRole("region", { name: "Branches and lifecycle" });
    await lifecycle.getByLabel("Branch name").fill(branchName);
    await lifecycle.getByLabel("Slug", { exact: true }).fill(`owner-branch-${suffix}`);
    const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/v1/staff/branches") && request.method() === "POST");
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/staff/branches") && response.request().method() === "POST");
    await lifecycle.getByRole("button", { name: "Create Branch" }).click();
    const [createRequest, createResponse] = await Promise.all([requestPromise, responsePromise]);
    expect(createResponse.status()).toBe(201);
    const createCommand = createRequest.postDataJSON();
    const replay = await apiJson(page, "/api/v1/staff/branches", { method: "POST", body: createCommand });
    expect(replay.status).toBe(200);
    expect(replay.body.meta.replay).toBe(true);

    const branch = lifecycle.locator("article").filter({ has: page.getByRole("heading", { name: branchName, exact: true }) });
    const status = branch.getByLabel(`${branchName} Branch status`);
    await expect(status).toHaveText("ACTIVE");
    await branch.getByRole("button", { name: "Suspend Branch" }).click();
    await expect(status).toHaveText("SUSPENDED");
    await branch.getByRole("button", { name: "Reactivate Branch" }).click();
    await expect(status).toHaveText("ACTIVE");

    const catalog = await getJson(page, `/api/v1/staff/branches?restaurantId=${restaurantId}&anchorBranchId=${branchId}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.find((entry: { name: string }) => entry.name === branchName)).toMatchObject({ status: "ACTIVE", version: 3, defaultLocale: "en" });
  } finally {
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("Manager cannot cross the Owner Branch lifecycle boundary", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page, managerRoleId);
  try {
    const catalog = await getJson(page, `/api/v1/staff/branches?restaurantId=${restaurantId}&anchorBranchId=${branchId}`);
    expect(catalog.status).toBe(403);
    expect(catalog.body.error.code).toBe("FORBIDDEN");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Branches and lifecycle" })).toHaveCount(0);
  } finally {
    await account.admin.auth.admin.deleteUser(account.userId);
  }
});

test("waiter workflow rotates a Join Code and submits an authoritative assisted order", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const workflowTableId = randomUUID();
  const workflowSessionId = randomUUID();
  const table = await admin.from("restaurant_tables").insert({ id: workflowTableId, restaurant_id: restaurantId, branch_id: branchId, label: `W-${workflowTableId.slice(0, 6)}`, capacity: 4, active: true });
  if (table.error) throw table.error;
  const session = await admin.from("dining_sessions").insert({ id: workflowSessionId, restaurant_id: restaurantId, branch_id: branchId, table_id: workflowTableId, state: "OPEN", guest_count: 2, business_date: new Date().toISOString().slice(0, 10), currency: "MYR" });
  if (session.error) throw session.error;
  const code = await admin.from("session_join_codes").insert({ session_id: workflowSessionId, code_hash: "a".repeat(64), expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  if (code.error) throw code.error;
  try {
    const rotation = await apiJson(page, `/api/v1/staff/sessions/${workflowSessionId}/join-code`, { method: "POST", body: { expectedSessionVersion: 1, idempotencyKey: randomUUID() } });
    expect(rotation.status).toBe(200);
    expect(rotation.body.data.joinCode).toMatch(/^\d{6}$/);
    expect(rotation.body.data.version).toBe(2);

    const order = await apiJson(page, `/api/v1/staff/sessions/${workflowSessionId}/orders`, { method: "POST", body: { expectedSessionVersion: 2, idempotencyKey: randomUUID(), items: [{ menuItemId: "00000000-0000-4000-8000-000000000401", variantId: "00000000-0000-4000-8000-000000000522", modifierOptionIds: ["00000000-0000-4000-8000-000000000512"], quantity: 1, note: "Synthetic assisted order" }] } });
    expect(order.status).toBe(200);
    const committed = await admin.from("orders").select("actor_type,total_minor").eq("id", order.body.data.orderId).single();
    if (committed.error) throw committed.error;
    expect(committed.data).toMatchObject({ actor_type: "WAITER", total_minor: 1980 });
  } finally {
    const orders = await admin.from("orders").select("id").eq("session_id", workflowSessionId);
    const orderIds = (orders.data ?? []).map((order) => order.id);
    if (orderIds.length > 0) await admin.from("order_items").delete().in("order_id", orderIds);
    await admin.from("orders").delete().eq("session_id", workflowSessionId);
    await admin.from("session_join_codes").delete().eq("session_id", workflowSessionId);
    await admin.from("dining_sessions").delete().eq("id", workflowSessionId);
    await admin.from("restaurant_tables").delete().eq("id", workflowTableId);
    await admin.auth.admin.deleteUser(account.userId);
  }
});

test("kitchen role cannot cross the serving capability boundary", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page, kitchenRoleId);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const testTableId = randomUUID();
  const testSessionId = randomUUID();
  const testOrderId = randomUUID();
  const testItemId = randomUUID();
  const seeded = await admin.from("restaurant_tables").insert({ id: testTableId, restaurant_id: restaurantId, branch_id: branchId, label: `K-${testTableId.slice(0, 6)}`, capacity: 2, active: true });
  if (seeded.error) throw seeded.error;
  await admin.from("dining_sessions").insert({ id: testSessionId, restaurant_id: restaurantId, branch_id: branchId, table_id: testTableId, state: "OPEN", guest_count: 2, business_date: new Date().toISOString().slice(0, 10), currency: "MYR" });
  await admin.from("orders").insert({ id: testOrderId, restaurant_id: restaurantId, branch_id: branchId, session_id: testSessionId, display_number: Math.floor(100000 + Math.random() * 800000), actor_type: "WAITER", state: "READY", subtotal_minor: 1680, total_minor: 1680, currency: "MYR", idempotency_key: randomUUID() });
  await admin.from("order_items").insert({ id: testItemId, restaurant_id: restaurantId, branch_id: branchId, order_id: testOrderId, menu_item_id: "00000000-0000-4000-8000-000000000401", name_snapshot: "Synthetic ready item", unit_price_minor: 1680, quantity: 1, station_key: "wok", state: "READY" });
  try {
    const served = await apiJson(page, `/api/v1/staff/kds/items/${testItemId}/transition`, { method: "POST", body: { nextState: "SERVED", expectedVersion: 1, idempotencyKey: randomUUID() } });
    expect(served.status).toBe(403);
    expect(served.body.error.code).toBe("FORBIDDEN");
    const item = await admin.from("order_items").select("state,version").eq("id", testItemId).single();
    expect(item.data).toEqual({ state: "READY", version: 1 });
  } finally {
    await admin.from("order_items").delete().eq("id", testItemId);
    await admin.from("orders").delete().eq("id", testOrderId);
    await admin.from("dining_sessions").delete().eq("id", testSessionId);
    await admin.from("restaurant_tables").delete().eq("id", testTableId);
    await admin.auth.admin.deleteUser(account.userId);
  }
});

test("cashier UI uses major currency amounts and recovers a pending tender", async ({ page }) => {
  await page.goto("/");
  const account = await signInSyntheticStaff(page);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const cashierTableId = randomUUID();
  const cashierSessionId = randomUUID();
  await admin.from("restaurant_tables").insert({ id: cashierTableId, restaurant_id: restaurantId, branch_id: branchId, label: `C-${cashierTableId.slice(0, 6)}`, capacity: 2, active: true });
  await admin.from("dining_sessions").insert({ id: cashierSessionId, restaurant_id: restaurantId, branch_id: branchId, table_id: cashierTableId, state: "OPEN", guest_count: 2, business_date: new Date().toISOString().slice(0, 10), total_due_minor: 3000, currency: "MYR" });
  try {
    await page.goto(`/cashier?sessionId=${cashierSessionId}`);
    await expect(page.getByLabel("Amount (MYR)")).toHaveValue("30.00");
    await page.getByLabel("Amount (MYR)").fill("10.00");
    await page.getByRole("button", { name: "Start payment" }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: "Pending tender recovered:" })).toContainText(/RM\s+10\.00/);
    await expect(page.getByLabel("Method")).toBeDisabled();
    await page.getByLabel("Cash received (MYR)").fill("12.00");
    await page.getByRole("button", { name: "Confirm observed tender" }).click();
    await expect(page.getByText("Paid snapshot").locator("..")).toContainText(/RM\s+10\.00/);
  } finally {
    await admin.from("payment_allocations").delete().eq("session_id", cashierSessionId);
    await admin.from("payments").delete().eq("session_id", cashierSessionId);
    await admin.from("dining_sessions").delete().eq("id", cashierSessionId);
    await admin.from("restaurant_tables").delete().eq("id", cashierTableId);
    await admin.auth.admin.deleteUser(account.userId);
  }
});

test("synthetic manager can backup, restore and remove a branch-scoped menu image", async ({ page }) => {
  await page.goto("/");
  const auth = await signInSyntheticStaff(page);
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } },
  });
  const objectPath = `${restaurantId}/${branchId}/${randomUUID()}.png`;
  const backupPath = `${restaurantId}/${branchId}/backups/${randomUUID()}.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const uploadedPaths: string[] = [];

  try {
    const upload = await storage.storage.from("menu-images").upload(objectPath, new Blob([png], { type: "image/png" }), { contentType: "image/png", upsert: false });
    if (upload.error) throw upload.error;
    uploadedPaths.push(objectPath);

    const downloaded = await storage.storage.from("menu-images").download(objectPath);
    if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error("Synthetic menu image did not download.");
    expect((await downloaded.data.arrayBuffer()).byteLength).toBe(png.byteLength);

    const backup = await storage.storage.from("menu-images").upload(backupPath, downloaded.data, { contentType: "image/png", upsert: false });
    if (backup.error) throw backup.error;
    uploadedPaths.push(backupPath);

    const restored = await storage.storage.from("menu-images").download(backupPath);
    if (restored.error || !restored.data) throw restored.error ?? new Error("Synthetic menu image did not restore.");
    expect(Buffer.from(await restored.data.arrayBuffer()).equals(png)).toBe(true);
  } finally {
    if (uploadedPaths.length > 0) {
      const removed = await storage.storage.from("menu-images").remove(uploadedPaths);
      if (removed.error) throw removed.error;
    }
  }
});
