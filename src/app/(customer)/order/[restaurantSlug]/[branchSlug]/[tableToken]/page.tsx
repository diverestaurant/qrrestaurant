import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { readCustomerEntryPage } from "@/server/role-queries";
import { CustomerMenu } from "@/ui/customer/CustomerMenu";
import { RoleShell } from "@/ui/role-shells/RoleShell";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ restaurantSlug: string; branchSlug: string; tableToken: string }> };

export default async function CustomerEntryPage({ params }: PageProps) {
  const { restaurantSlug, branchSlug, tableToken } = await params;
  if (!restaurantSlug || !branchSlug || !tableToken) notFound();
  let data;
  try {
    data = await readCustomerEntryPage({ restaurantSlug, branchSlug, tableToken });
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { entry, menu } = data;
  const freshness = menu.freshness === "fresh" ? "Local Supabase · synced just now" : "Local Supabase · unavailable";
  return <RoleShell role="Customer" title={`Welcome to ${entry.restaurantName}`} description={`${entry.branchName} · ${entry.tableLabel}. Browse freely; enter the current Join Code before viewing or changing this table's live Session.`} freshness={freshness}><CustomerMenu menuView={menu} entry={{ restaurantSlug, branchSlug, tableToken, tableLabel: entry.tableLabel }} /></RoleShell>;
}
