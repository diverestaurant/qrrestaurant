export type Freshness = "fresh" | "reconnecting" | "stale" | "offline";
export type QueryStatus = "loading" | "ready" | "empty" | "error" | "permission_denied" | "suspended";
export type CommandStatus = "pending" | "confirmed" | "failed" | "unknown_outcome" | "conflict";

export type ViewState = { status: QueryStatus; freshness: Freshness; serverTime?: string; lastSyncedAt?: string; version?: number; correlationId?: string };
export type CommandResult<T> = { status: CommandStatus; data?: T; error?: { code: string; message: string; retryable: boolean; correlationId: string }; version?: number; idempotencyResultId?: string };

export type CustomerMenuVariantView = { id: string; name: string; priceDeltaMinor: number };
export type CustomerMenuModifierOptionView = { id: string; name: string; priceDeltaMinor: number };
export type CustomerMenuModifierGroupView = { id: string; name: string; required: boolean; minSelections: number; maxSelections: number; options: CustomerMenuModifierOptionView[] };
export type CustomerMenuItemView = { id: string; name: string; description: string; priceMinor: number; available: boolean; availabilityReason: "AVAILABLE" | "SOLD_OUT" | "OUTSIDE_HOURS"; category: string; imageUrl: string | null; imageAlt: string; featured: boolean; spiceLevel: number; variants: CustomerMenuVariantView[]; modifierGroups: CustomerMenuModifierGroupView[] };
export type CustomerMenuView = ViewState & { restaurantId: string; branchId: string; restaurantName: string; branchName: string; currency: string; items: CustomerMenuItemView[] };
export type ResolveTableEntryView = ViewState & { restaurantName: string; branchName: string; tableLabel: string; orderingRequiresJoin: true };
export type CustomerSessionView = ViewState & { sessionId: string; restaurantId: string; branchId: string; state: "OPEN" | "PAYMENT_REQUESTED" | "PAYMENT_PENDING" | "PAID" | "CLOSED" | "CANCELLED"; version: number; totalDueMinor: number; totalPaidMinor: number; currency: string; grantExpiresAt: string };
export type CustomerOrderView = { id: string; displayNumber: number; state: string; version: number; totalMinor: number; currency: string; createdAt: string; items: Array<{ name: string; quantity: number; unitPriceMinor: number; note: string | null }> };
export type CustomerServiceRequestView = { id: string; requestType: "CALL_WAITER" | "CUTLERY" | "WATER" | "BILL" | "OTHER"; note: string | null; state: "OPEN" | "CLAIMED" | "RESOLVED" | "CANCELLED"; version: number; createdAt: string };
export type KdsQueueItemView = { id: string; tableLabel: string; name: string; quantity: number; state: string; elapsedMinutes: number; version: number; note: string | null; variantLabel: string | null; modifierLabels: string[] };
export type KdsQueueView = ViewState & { stationKey: string; stationName: string; stations: Array<{ key: string; name: string }>; items: KdsQueueItemView[]; recentlyCompleted: Array<KdsQueueItemView & { completedAt: string }> };
export type StaffContextView = ViewState & { role: "OWNER" | "MANAGER" | "KITCHEN" | "WAITER" | "CASHIER" | "PLATFORM"; branchId: string; capabilities: string[] };
export type AdminOverviewView = {
  branchName: string;
  settings: {
    restaurant: { name: string; slug: string; defaultCurrency: string; defaultTimezone: string; version: number; legalName: string; registrationNumber: string; taxRegistrationNumber: string; contactPhone: string; contactEmail: string; brandAccent: string; receiptFooter: string; settingsVersion: number };
    branch: { name: string; slug: string; currency: string; timezone: string; businessDayCutoff: string; version: number; defaultLocale: "en" | "zh" | "ms"; addressLine1: string; addressLine2: string; city: string; postalCode: string; countryCode: string; contactPhone: string; contactEmail: string; settingsVersion: number };
  };
  menuItems: number;
  menu: Array<{ id: string; categoryId: string; name: string; description: string; basePriceMinor: number; currency: string; stationKey: string; visible: boolean; available: boolean; sortOrder: number; featured: boolean; spiceLevel: number; taxEligible: boolean; serviceEligible: boolean; operatingRules: Record<string, unknown>; imagePath: string; imageAlt: string; version: number; variants: Array<{ id: string; name: string; priceDeltaMinor: number; active: boolean; sortOrder: number; version: number }> }>;
  categories: Array<{ id: string; name: string; sortOrder: number; visible: boolean; version: number }>;
  modifierGroups: Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; active: boolean; version: number; linkedMenuItemIds: string[]; options: Array<{ id: string; name: string; priceDeltaMinor: number; active: boolean; sortOrder: number; version: number }> }>;
  tables: Array<{ id: string; label: string; area: string; capacity: number; active: boolean; version: number }>;
  memberships: Array<{ id: string; userId: string; roleId: string; status: string; version: number }>;
  roles: Array<{ id: string; roleKey: string; displayName: string; capabilities: string[] }>;
  stations: Array<{ id: string; stationKey: string; name: string; active: boolean; version: number }>;
  featureFlags: Array<{ id: string; flagKey: string; description: string; enabled: boolean; version: number }>;
  audits: Array<{ id: string; action: string; entityType: string; entityId: string | null; reason: string; createdAt: string }>;
  unavailableItems: number;
  activeTables: number;
  staffMembers: number;
  openSessions: number;
  lastSyncedAt: string;
};
