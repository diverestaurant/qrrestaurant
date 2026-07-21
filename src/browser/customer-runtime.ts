"use client";

// Browser composition root: UI components depend on this narrow runtime
// surface instead of importing Supabase adapters directly.
export { ensureAnonymousCustomerIdentity } from "@/modules/customer/infrastructure/browser-identity";
export { useCustomerMenuRealtime } from "@/modules/realtime/infrastructure/use-customer-menu-realtime";
export { useCustomerSessionRealtime } from "@/modules/realtime/infrastructure/use-customer-session-realtime";
