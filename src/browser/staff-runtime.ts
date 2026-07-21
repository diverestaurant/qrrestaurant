"use client";

// Browser composition root for staff Auth and Realtime adapters.
export { useStaffBranchRealtime } from "@/modules/realtime/infrastructure/use-staff-branch-realtime";
export { getBrowserSupabaseClient } from "@/server/supabase/browser";
