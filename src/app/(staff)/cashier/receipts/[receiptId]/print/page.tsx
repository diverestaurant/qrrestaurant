import { notFound } from "next/navigation";
import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";
import { readReceiptPrintPage, readStaffPageAccess } from "@/server/role-queries";
import { PrintableReceipt } from "@/ui/staff/PrintableReceipt";
import { StaffGate } from "@/ui/staff/StaffGate";

export const dynamic = "force-dynamic";

export default async function ReceiptPrintPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const access = await readStaffPageAccess({ branchId: localDemoBranchId, restaurantId: localDemoRestaurantId, requiredCapabilities: ["receipt.issue"] });
  if (access.status !== "authorized") return <main className="mx-auto w-full max-w-3xl p-6"><StaffGate role="Cashier" access={access.status} email={access.status === "forbidden" ? access.email : undefined} /></main>;
  const { receiptId } = await params;
  const receipt = await readReceiptPrintPage(receiptId, localDemoBranchId, localDemoRestaurantId);
  if (!receipt) notFound();
  return <PrintableReceipt id={receipt.id} number={receipt.number} reprintOf={receipt.reprintOf} snapshot={receipt.snapshot} />;
}
