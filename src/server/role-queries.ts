import "server-only";

import { demoMenu } from "@/modules/menu/contracts/menu";
import { readLocalKdsQueue } from "@/modules/kds/infrastructure/local-queue-repository";
import { readPublicMenu } from "@/modules/menu/infrastructure/public-menu-repository";
import { resolvePublicTableEntry } from "@/modules/sessions/infrastructure/public-entry-repository";
import {
  readLocalAdminOverview,
  readLocalCashierBoard,
  readLocalWaiterBoard,
} from "@/modules/staff/infrastructure/local-operations-repository";
import { logger } from "@/server/observability/logger";
import { authorizeStaffPage } from "@/server/staff-page-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

export { authorizeStaffPage as readStaffPageAccess };

export async function readCustomerEntryPage(input: { restaurantSlug: string; branchSlug: string; tableToken: string }) {
  const supabase = await getServerSupabaseClient();
  const [entry, menu] = await Promise.all([
    resolvePublicTableEntry(input, supabase),
    readPublicMenu({ restaurantSlug: input.restaurantSlug, branchSlug: input.branchSlug }),
  ]);
  return { entry, menu };
}

export async function readCustomerDemoPage() {
  try {
    return await readPublicMenu({ restaurantSlug: "dive-demo", branchSlug: "main" });
  } catch {
    logger.warn("Customer menu unavailable in Supabase", { action: "customer.menu.load" });
    return { ...demoMenu, status: "error" as const, freshness: "offline" as const, items: [] };
  }
}

export async function readWaiterPage(branchId: string) {
  return Promise.all([
    readLocalWaiterBoard(branchId),
    readPublicMenu({ restaurantSlug: "dive-demo", branchSlug: "main" }),
  ]);
}

export async function readKdsPage(branchId: string, station?: string) {
  return readLocalKdsQueue(branchId, station);
}

export async function readCashierPage(branchId: string, sessionId?: string) {
  return readLocalCashierBoard(branchId, sessionId);
}

export async function readAdminPage(branchId: string) {
  return readLocalAdminOverview(branchId);
}
