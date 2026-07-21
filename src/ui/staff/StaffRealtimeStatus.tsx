"use client";

import { useRouter } from "next/navigation";
import { useStaffBranchRealtime } from "@/browser/staff-runtime";
import { localDemoBranchId, localDemoRestaurantId } from "@/config/demo-scope";

export function StaffRealtimeStatus() {
  const router = useRouter();
  const status = useStaffBranchRealtime({ restaurantId: localDemoRestaurantId, branchId: localDemoBranchId, onResync: () => router.refresh() });
  return <span className="text-xs text-muted" role="status">Staff live: {status === "connected" ? "connected" : status === "reconnecting" ? "reconnecting" : status === "offline" ? "offline; polling" : "connecting"}</span>;
}
