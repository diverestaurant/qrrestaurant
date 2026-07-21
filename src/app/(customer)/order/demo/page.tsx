import { RoleShell } from "@/ui/role-shells/RoleShell";
import { CustomerMenu } from "@/ui/customer/CustomerMenu";
import { readCustomerDemoPage } from "@/server/role-queries";

export const dynamic = "force-dynamic";

const localDemoSessionId = "00000000-0000-4000-8000-000000000701";

export default async function CustomerDemoPage() {
  const menu = await readCustomerDemoPage();
  const freshness = menu.freshness === "fresh" ? "Supabase · synced just now" : "Supabase · unavailable";
  return <RoleShell role="Customer" title="Welcome to DIVE" description="A mobile-first public menu with an explicit Join Code boundary. Static QR discovers the table; it never grants an old Session." freshness={freshness}><CustomerMenu menuView={menu} sessionId={localDemoSessionId} tableLabel="T99 synthetic demo table" /></RoleShell>;
}
