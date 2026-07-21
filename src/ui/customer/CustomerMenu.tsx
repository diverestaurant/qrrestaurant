"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ensureAnonymousCustomerIdentity, useCustomerMenuRealtime, useCustomerSessionRealtime } from "@/browser/customer-runtime";
import type { CustomerMenuView, CustomerOrderView, CustomerServiceRequestView, CustomerSessionView } from "@/contracts/view-models";
import { formatMoney } from "@/lib/format";
import { reconcileCustomerCart, type CustomerCartLine } from "@/modules/menu/domain/reconcile-customer-cart";
import { StatusPill } from "@/ui/primitives/StatusPill";

type ApiErrorPayload = { error: { code: string; message: string; retryable: boolean } };
type ApiSuccess<T> = { ok: true; data: T; meta?: { replay?: boolean } };

class CustomerApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean, public readonly status: number) {
    super(message);
    this.name = "CustomerApiError";
  }
}

async function callCustomerApi<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new CustomerApiError("NETWORK_ERROR", "The connection was interrupted. The result may be unknown.", true, 0);
  }
  const body = await response.json().catch(() => null) as ApiSuccess<T> | ApiErrorPayload | null;
  if (!response.ok || !body || !("ok" in body) || body.ok !== true) {
    const error = body && "error" in body ? body.error : { code: "INTERNAL_ERROR", message: "The request could not be completed.", retryable: true };
    throw new CustomerApiError(error.code, error.message, error.retryable, response.status);
  }
  return body;
}

type CustomerMenuProps = { menuView: CustomerMenuView; sessionId?: string; entry?: { restaurantSlug: string; branchSlug: string; tableToken: string; tableLabel: string }; tableLabel?: string };
type JoinState = "idle" | "pending" | "joined" | "failed";
type OrderState = "idle" | "pending" | "confirmed" | "failed" | "unknown" | "conflict";
type ServiceState = "idle" | "pending" | "confirmed" | "failed" | "unknown";
type MenuItem = CustomerMenuView["items"][number];
type CartLine = CustomerCartLine;

const serviceOptions = [
  { type: "CALL_WAITER" as const, label: "Call waiter", detail: "Someone will come to your table." },
  { type: "WATER" as const, label: "Ask for water", detail: "Request a water refill." },
  { type: "CUTLERY" as const, label: "Ask for cutlery", detail: "Request extra cutlery." },
  { type: "BILL" as const, label: "Ask for the bill", detail: "Let the team know you are ready." },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Ask a staff member for help.";
}

export function CustomerMenu({ menuView: initialMenuView, sessionId: initialSessionId, entry, tableLabel = entry?.tableLabel ?? "your table" }: CustomerMenuProps) {
  const [hydrated, setHydrated] = useState(false);
  const [menuView, setMenuView] = useState(initialMenuView);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customizingItemId, setCustomizingItemId] = useState<string | null>(null);
  const [draftVariantId, setDraftVariantId] = useState<string | undefined>(undefined);
  const [draftModifierOptionIds, setDraftModifierOptionIds] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId ?? null);
  const [session, setSession] = useState<CustomerSessionView | null>(null);
  const [orders, setOrders] = useState<CustomerOrderView[]>([]);
  const [serviceRequests, setServiceRequests] = useState<CustomerServiceRequestView[]>([]);
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderKey, setOrderKey] = useState<string | null>(null);
  const [serviceState, setServiceState] = useState<ServiceState>("idle");
  const [serviceCommand, setServiceCommand] = useState<{ key: string; type: CustomerServiceRequestView["requestType"] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const menu = menuView.items;
  const visibleMenu = useMemo(() => menu.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase())), [menu, search]);
  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartLines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const joined = joinState === "joined" && session !== null;
  const entityVersions = useMemo(() => Object.fromEntries([...orders.map((order) => [order.id, order.version]), ...serviceRequests.map((request) => [request.id, request.version])]), [orders, serviceRequests]);

  // Deliberate hydration guard for buttons with command side effects.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  const refreshMenu = useCallback(async () => {
    const restaurantSlug = entry?.restaurantSlug ?? "dive-demo";
    const branchSlug = entry?.branchSlug ?? "main";
    const result = await callCustomerApi<CustomerMenuView>(`/api/v1/customer/menu?restaurantSlug=${encodeURIComponent(restaurantSlug)}&branchSlug=${encodeURIComponent(branchSlug)}`);
    const reconciled = reconcileCustomerCart(cart, result.data.items);
    setMenuView(result.data);
    setCart(reconciled.cart);
    if (reconciled.removedCount > 0 || reconciled.repricedCount > 0) {
      const changes = [reconciled.removedCount > 0 ? `${reconciled.removedCount} unavailable cart item${reconciled.removedCount === 1 ? " was" : "s were"} removed` : null, reconciled.repricedCount > 0 ? `${reconciled.repricedCount} cart item${reconciled.repricedCount === 1 ? " was" : "s were"} repriced` : null].filter(Boolean).join("; ");
      setMenuMessage(`The menu changed: ${changes}. Please review before ordering.`);
    }
  }, [cart, entry?.branchSlug, entry?.restaurantSlug]);
  const menuRealtime = useCustomerMenuRealtime({ restaurantId: menuView.restaurantId, branchId: menuView.branchId, onResync: refreshMenu });

  function configurationKey(item: MenuItem, variantId: string | undefined, modifierOptionIds: string[]) {
    return `${item.id}:${variantId ?? "base"}:${[...modifierOptionIds].sort().join(",")}`;
  }

  function configuredPrice(item: MenuItem, variantId: string | undefined, modifierOptionIds: string[]) {
    const variantDelta = item.variants.find((variant) => variant.id === variantId)?.priceDeltaMinor ?? 0;
    const modifierDelta = modifierOptionIds.reduce((sum, optionId) => sum + (item.modifierGroups.flatMap((group) => group.options).find((option) => option.id === optionId)?.priceDeltaMinor ?? 0), 0);
    return item.priceMinor + variantDelta + modifierDelta;
  }

  function addConfiguredItem(item: MenuItem, variantId: string | undefined, modifierOptionIds: string[]) {
    const key = configurationKey(item, variantId, modifierOptionIds);
    setCart((current) => {
      const existing = current[key];
      return { ...current, [key]: { key, item, quantity: (existing?.quantity ?? 0) + 1, variantId, modifierOptionIds, unitPriceMinor: configuredPrice(item, variantId, modifierOptionIds) } };
    });
    setCustomizingItemId(null);
  }

  function openCustomizer(item: MenuItem) {
    setCustomizingItemId(item.id);
    setDraftVariantId(item.variants[0]?.id);
    setDraftModifierOptionIds([]);
  }

  function toggleModifier(optionId: string) {
    setDraftModifierOptionIds((current) => current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]);
  }

  const refreshCustomerData = useCallback(async (targetSessionId = activeSessionId) => {
    if (!targetSessionId) throw new Error("Join the table before reading the current Session.");
    try {
      const [sessionResult, ordersResult, requestsResult] = await Promise.all([
        callCustomerApi<CustomerSessionView>(`/api/v1/customer/sessions/${targetSessionId}`),
        callCustomerApi<CustomerOrderView[]>(`/api/v1/customer/orders?sessionId=${encodeURIComponent(targetSessionId)}`),
        callCustomerApi<CustomerServiceRequestView[]>(`/api/v1/customer/service-requests?sessionId=${encodeURIComponent(targetSessionId)}`),
      ]);
      setSession(sessionResult.data);
      setOrders(ordersResult.data);
      setServiceRequests(requestsResult.data);
    } catch (error) {
      if (error instanceof CustomerApiError && (error.status === 401 || error.status === 403)) {
        setSession(null);
        setOrders([]);
        setServiceRequests([]);
        setActiveSessionId(null);
        setJoinState("failed");
        setJoinCode("");
        setMessage("This table Session ended or your access expired. Ask staff for the current Join Code.");
      }
      throw error;
    }
  }, [activeSessionId]);
  const realtime = useCustomerSessionRealtime({ sessionId: joined ? session.sessionId : null, restaurantId: joined ? session.restaurantId : null, branchId: joined ? session.branchId : null, sessionVersion: session?.version ?? 0, entityVersions, onResync: refreshCustomerData });

  async function joinTable() {
    setJoinState("pending");
    setMessage(null);
    try {
      await ensureAnonymousCustomerIdentity();
      if (!entry && !activeSessionId) throw new Error("This table entry is missing its Session context.");
      const joinPayload = entry ? { restaurantSlug: entry.restaurantSlug, branchSlug: entry.branchSlug, tableToken: entry.tableToken, joinCode } : { sessionId: activeSessionId, joinCode };
      const result = await callCustomerApi<{ sessionId?: string; grantId: string; expiresAt: string }>("/api/v1/customer/sessions/join", { method: "POST", body: JSON.stringify(joinPayload) });
      const joinedSessionId = result.data.sessionId ?? activeSessionId;
      if (!joinedSessionId) throw new Error("The current Session was not returned.");
      setActiveSessionId(joinedSessionId);
      await refreshCustomerData(joinedSessionId);
      setJoinState("joined");
    } catch (error) {
      setJoinState("failed");
      setMessage(getErrorMessage(error));
    }
  }

  async function submitOrder() {
    if (!session || itemCount === 0 || orderState === "pending") return;
    const currentOrderKey = orderKey ?? crypto.randomUUID();
    setOrderKey(currentOrderKey);
    setOrderState("pending");
    setMessage(null);
    try {
      const result = await callCustomerApi<{ orderId: string; version: number }>("/api/v1/customer/orders", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.sessionId, items: cartLines.map((line) => ({ menuItemId: line.item.id, variantId: line.variantId, quantity: line.quantity, modifierOptionIds: line.modifierOptionIds, ...(line.note ? { note: line.note } : {}) })), idempotencyKey: currentOrderKey, expectedSessionVersion: session.version }),
      });
      setOrderId(result.data.orderId);
      setOrderKey(null);
      setOrderState("confirmed");
      setCart({});
      await refreshCustomerData(session.sessionId);
    } catch (error) {
      if (error instanceof CustomerApiError && (error.code === "STALE_STATE" || error.code === "CONFLICT")) {
        setOrderKey(null);
        setOrderState("conflict");
        setMessage(error.message);
        try { await Promise.all([refreshCustomerData(), refreshMenu()]); } catch { /* Keep the conflict visible when either refresh is unavailable. */ }
      } else if (error instanceof CustomerApiError && error.code === "UNKNOWN_OUTCOME" || error instanceof CustomerApiError && error.code === "NETWORK_ERROR") {
        setOrderState("unknown");
        setMessage("We could not confirm the result. Retry with the same order button; the order key is preserved.");
      } else {
        setOrderState("failed");
        setMessage(getErrorMessage(error));
      }
    }
  }

  async function requestService(type: CustomerServiceRequestView["requestType"]) {
    if (!session || serviceState === "pending") return;
    const current = serviceCommand?.type === type ? serviceCommand : { key: crypto.randomUUID(), type };
    setServiceCommand(current);
    setServiceState("pending");
    setMessage(null);
    try {
      await callCustomerApi<{ requestId: string; version: number }>("/api/v1/customer/service-requests", { method: "POST", body: JSON.stringify({ sessionId: session.sessionId, requestType: type, idempotencyKey: current.key }) });
      setServiceState("confirmed");
      await refreshCustomerData(session.sessionId);
    } catch (error) {
      if (error instanceof CustomerApiError && (error.code === "UNKNOWN_OUTCOME" || error.code === "NETWORK_ERROR")) {
        setServiceState("unknown");
        setMessage("The request result is unknown. Tap the same request again to retry safely.");
      } else {
        setServiceState("failed");
        setMessage(getErrorMessage(error));
      }
    }
  }

  const orderStatus = orderState === "confirmed" ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950" role="status"><strong>Order sent.</strong> Your order is now in the restaurant queue{orderId ? ` · ${orderId.slice(0, 8)}` : ""}.</div> : orderState === "unknown" ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="status"><strong>Order status unknown.</strong> We did not assume failure. Retry with the same order button.</div> : orderState === "conflict" ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="status"><strong>Refresh required.</strong> The menu or Session changed. Review your cart and submit again.</div> : null;
  const serviceStatus = serviceState === "confirmed" ? <p className="mt-3 text-sm text-emerald-700" role="status">Request sent to the team.</p> : serviceState === "unknown" ? <p className="mt-3 text-sm text-amber-700" role="status">Result unknown; tap the same request again.</p> : null;

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted">{menuView.restaurantName} · {menuView.branchName}</p><h2 className="mt-1 text-2xl font-semibold">What sounds good?</h2><p className="mt-1 text-xs text-muted" role="status">Menu updates: {menuRealtime.status === "connected" ? "live" : menuRealtime.status === "reconnecting" ? "reconnecting; checking the database" : menuRealtime.status === "offline" ? "offline; use refresh" : "connecting"}</p></div><div className="flex items-center gap-2"><button className="min-h-10 rounded-full border px-3 text-xs font-semibold" onClick={() => void refreshMenu()}>Refresh menu</button><StatusPill label={menuView.status === "ready" ? "Menu available" : menuView.status === "empty" ? "Menu empty" : "Menu unavailable"} tone={menuView.status === "ready" ? "success" : "warning"} /></div></div>
        {menuMessage && <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status"><span>{menuMessage}</span><button className="shrink-0 underline underline-offset-2" onClick={() => setMenuMessage(null)}>Dismiss</button></div>}
        <label className="mb-5 block text-sm font-medium">Search menu<input className="mt-2 min-h-12 w-full rounded-2xl border bg-surface px-4" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dish, category, ingredient" /></label>
        {menuView.status === "error" || menuView.status === "suspended" ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950" role="alert"><strong>Menu temporarily unavailable.</strong> Check the connection or ask a staff member for help.</div> : menuView.items.length === 0 ? <div className="rounded-3xl border border-dashed bg-surface p-6 text-sm leading-6 text-muted">There are no available items right now. Please ask a staff member for help.</div> : <div className="grid gap-4 sm:grid-cols-2">
          {visibleMenu.map((item) => {
            const hasCustomization = item.variants.length > 0 || item.modifierGroups.length > 0;
            const customizing = customizingItemId === item.id;
            const selectedOptions = item.modifierGroups.flatMap((group) => group.options).filter((option) => draftModifierOptionIds.includes(option.id));
            return <article className="overflow-hidden rounded-3xl border bg-surface shadow-sm" key={item.id}>
              {item.imageUrl && <div className="relative aspect-[16/9] bg-background"><Image alt={item.imageAlt || item.name} className="object-cover" fill sizes="(max-width: 640px) 100vw, 50vw" src={item.imageUrl} unoptimized /></div>}
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.1em] text-brand uppercase">{item.category}{item.featured ? " · Featured" : ""}{item.spiceLevel > 0 ? ` · Spice ${item.spiceLevel}/3` : ""}</p><h3 className="mt-2 text-lg font-semibold">{item.name}</h3></div>{!item.available && <StatusPill label={item.availabilityReason === "OUTSIDE_HOURS" ? "Not serving now" : "Sold out"} tone="warning" />}</div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted">{item.description}</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><strong className="font-mono text-base tabular-nums">{formatMoney(item.priceMinor, menuView.currency)}</strong><div className="flex flex-wrap justify-end gap-2"><button aria-label={`Add ${item.name} to order`} className="min-h-12 rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:bg-slate-300" disabled={!item.available} onClick={() => addConfiguredItem(item, undefined, [])}>{item.available ? "Add to order" : item.availabilityReason === "OUTSIDE_HOURS" ? "Not serving now" : "Sold out"}</button>{hasCustomization && <button aria-label={`Customize ${item.name}`} className="min-h-12 rounded-full border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-brand-soft disabled:border-slate-300 disabled:text-slate-400" disabled={!item.available} onClick={() => openCustomizer(item)}>Customize</button>}</div></div>
              {customizing && <div className="mt-5 rounded-2xl border border-brand/30 bg-brand-soft/30 p-4" aria-label={`Customize ${item.name}`}>
                <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Customize {item.name}</h4><button className="text-sm text-muted underline underline-offset-2" onClick={() => setCustomizingItemId(null)}>Close</button></div>
                {item.variants.length > 0 && <fieldset className="mt-4"><legend className="text-sm font-semibold">Choose a variant</legend><div className="mt-2 grid gap-2">{item.variants.map((variant) => <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2 text-sm" key={variant.id}><span><input className="mr-2" type="radio" name={`variant-${item.id}`} checked={draftVariantId === variant.id} onChange={() => setDraftVariantId(variant.id)} />{variant.name}</span><span className="font-mono tabular-nums">{variant.priceDeltaMinor === 0 ? "Included" : `+${formatMoney(variant.priceDeltaMinor, menuView.currency)}`}</span></label>)}</div></fieldset>}
                {item.modifierGroups.map((group) => <fieldset className="mt-4" key={group.id}><legend className="text-sm font-semibold">{group.name} <span className="font-normal text-muted">({group.required ? `choose ${group.minSelections}-${group.maxSelections}` : `up to ${group.maxSelections}`})</span></legend><div className="mt-2 grid gap-2">{group.options.map((option) => { const checked = draftModifierOptionIds.includes(option.id); const atLimit = !checked && selectedOptions.length >= group.maxSelections; return <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2 text-sm" key={option.id}><span><input className="mr-2" type="checkbox" checked={checked} disabled={atLimit} onChange={() => toggleModifier(option.id)} />{option.name}</span><span className="font-mono tabular-nums">{option.priceDeltaMinor === 0 ? "Included" : `+${formatMoney(option.priceDeltaMinor, menuView.currency)}`}</span></label>; })}</div></fieldset>)}
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm text-muted">Estimated configuration</span><strong className="font-mono tabular-nums">{formatMoney(configuredPrice(item, draftVariantId, draftModifierOptionIds), menuView.currency)}</strong></div>
                <button className="mt-4 min-h-12 w-full rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!hydrated || item.modifierGroups.some((group) => group.required && draftModifierOptionIds.filter((id) => group.options.some((option) => option.id === id)).length < group.minSelections)} onClick={() => addConfiguredItem(item, draftVariantId, draftModifierOptionIds)}>Add customized item</button>
              </div>}</div>
            </article>;
          })}
        </div>}
      </section>
      <aside id="customer-cart" className="h-fit rounded-3xl border bg-surface p-5 shadow-sm lg:sticky lg:top-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your order</h2><StatusPill label={`${itemCount} item${itemCount === 1 ? "" : "s"}`} /></div>
        <p className="mt-2 text-sm text-muted">{joined ? `Joined at ${tableLabel}` : `Join ${tableLabel} with the code from your waiter.`}</p>
        {cartLines.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed p-5 text-sm leading-6 text-muted">Your cart is empty. Add a dish to begin. The estimate will always be rechecked by the server.</div> : <div className="mt-5 space-y-4">{cartLines.map((line) => <div className="rounded-2xl border p-3" key={line.key}><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{line.item.name}</p><p className="mt-1 text-xs text-muted">{line.variantId ? line.item.variants.find((variant) => variant.id === line.variantId)?.name : "Standard"}{line.modifierOptionIds.length > 0 ? ` · ${line.modifierOptionIds.map((id) => line.item.modifierGroups.flatMap((group) => group.options).find((option) => option.id === id)?.name).filter(Boolean).join(", ")}` : ""}</p><div className="mt-1 flex items-center gap-2 text-sm text-muted"><span>Qty {line.quantity}</span><button className="underline underline-offset-2" onClick={() => setCart((current) => { const next = { ...current }; if (line.quantity <= 1) delete next[line.key]; else next[line.key] = { ...line, quantity: line.quantity - 1 }; return next; })}>Remove one</button></div></div><span className="font-mono text-sm tabular-nums">{formatMoney(line.unitPriceMinor * line.quantity, menuView.currency)}</span></div><label className="mt-3 block text-xs text-muted">Kitchen note<input className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground" maxLength={240} value={line.note ?? ""} onChange={(event) => setCart((current) => ({ ...current, [line.key]: { ...line, note: event.target.value } }))} placeholder="Optional request" /></label></div>)}</div>}
        <div className="mt-6 border-t pt-5"><div className="flex justify-between text-sm text-muted"><span>Estimate</span><span className="font-mono tabular-nums">{formatMoney(total, menuView.currency)}</span></div><p className="mt-2 text-xs leading-5 text-muted">Final price, tax, service, and availability are confirmed on submission.</p></div>
        <label className="mt-6 block text-sm font-medium" htmlFor="join-code">Join Code <span className="font-normal text-muted">(from your waiter)</span></label><input aria-describedby="join-help" className="mt-2 min-h-12 w-full rounded-2xl border bg-background px-4 font-mono tracking-[0.25em] uppercase" id="join-code" inputMode="numeric" maxLength={6} onChange={(event) => { setJoinCode(event.target.value.replace(/\D/g, "")); setJoinState((current) => current === "failed" ? "idle" : current); }} onInput={(event) => setJoinCode(event.currentTarget.value.replace(/\D/g, ""))} placeholder="••••••" value={joinCode} /><p className="mt-2 text-xs leading-5 text-muted" id="join-help">The code connects this browser to the current table Session. It does not expose a password.</p>
        <button className="mt-4 min-h-12 w-full rounded-full border border-brand px-4 font-semibold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400" disabled={!hydrated || joinState === "pending" || joined} onClick={() => void joinTable()}>{joinState === "pending" ? "Joining…" : joined ? "Table joined" : "Join table"}</button>
        {joinState === "failed" && message && <p className="mt-3 text-sm text-danger" role="alert">{message}</p>}
        {orderStatus}
        <button className="mt-4 min-h-12 w-full rounded-full bg-brand px-4 font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!hydrated || !joined || !joinCode || itemCount === 0 || orderState === "pending"} onClick={() => void submitOrder()}>{orderState === "pending" ? "Sending order…" : orderState === "unknown" ? "Retry order safely" : "Submit order"}</button>
        {message && orderState !== "unknown" && orderState !== "conflict" && joinState !== "failed" && <p className="mt-3 text-sm text-danger" role="alert">{message}</p>}

        <div className="mt-8 border-t pt-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Need a hand?</h2><StatusPill label={joined ? "Available" : "Join first"} tone={joined ? "success" : "neutral"} /></div><p className="mt-2 text-sm leading-6 text-muted">Requests are sent to the waiter queue and can be retried safely.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{serviceOptions.map((option) => <button className="min-h-12 rounded-2xl border px-4 py-3 text-left transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50" disabled={!hydrated || !joined || serviceState === "pending"} key={option.type} onClick={() => void requestService(option.type)}><span className="block text-sm font-semibold">{serviceCommand?.type === option.type && serviceState === "unknown" ? `Retry: ${option.label}` : option.label}</span><span className="mt-1 block text-xs text-muted">{option.detail}</span></button>)}</div>{serviceStatus}</div>

        {joined && <div className="mt-8 border-t pt-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Session updates</h2><button className="text-sm font-semibold text-brand underline underline-offset-2" onClick={() => void refreshCustomerData()}>Refresh</button></div><p className="mt-2 text-sm text-muted">{session?.state.replaceAll("_", " ")} · {orders.length} order{orders.length === 1 ? "" : "s"} · {serviceRequests.length} request{serviceRequests.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-muted" role="status">Live updates: {realtime.status === "connected" ? "connected" : realtime.status === "reconnecting" ? "reconnecting; checking the database" : realtime.status === "offline" ? "offline; manual retry available" : "connecting"}</p>{serviceRequests.slice(0, 4).map((request) => <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-background p-3 text-sm" key={request.id}><span>{request.requestType.replaceAll("_", " ")}</span><StatusPill label={request.state} tone={request.state === "RESOLVED" ? "success" : request.state === "CLAIMED" ? "info" : "warning"} /></div>)}{orders.slice(0, 3).map((order) => <div className="mt-4 rounded-2xl border p-4" key={order.id}><div className="flex justify-between gap-3 text-sm"><strong>Order #{order.displayNumber}</strong><span className="text-muted">{order.state}</span></div><p className="mt-1 text-sm text-muted">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Items pending"}</p><p className="mt-2 font-mono text-sm tabular-nums">{formatMoney(order.totalMinor, order.currency)}</p></div>)}</div>}
      </aside>
      {itemCount > 0 && <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl border bg-surface/95 p-3 shadow-xl backdrop-blur lg:hidden"><div><p className="text-sm font-semibold">{itemCount} item{itemCount === 1 ? "" : "s"}</p><p className="font-mono text-sm">{formatMoney(total, menuView.currency)}</p></div><button className="min-h-12 rounded-full bg-brand px-5 text-sm font-semibold text-white" onClick={() => document.getElementById("customer-cart")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Review order</button></div>}
    </div>
  );
}
