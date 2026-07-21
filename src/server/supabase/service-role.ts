import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env";

let serviceRoleClient: SupabaseClient | undefined;

export function getServiceRoleSupabaseClient() {
  if (!serviceRoleClient) {
    const env = getServerEnv();
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-only idempotency bookkeeping.");
    serviceRoleClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  }
  return serviceRoleClient;
}
