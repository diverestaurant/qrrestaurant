import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/config/env";

let healthClient: SupabaseClient | undefined;

export function getHealthSupabaseClient() {
  if (!healthClient) {
    const env = getPublicEnv();
    healthClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return healthClient;
}
