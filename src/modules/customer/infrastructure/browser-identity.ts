"use client";

import { getBrowserSupabaseClient } from "@/server/supabase/browser";

export async function ensureAnonymousCustomerIdentity() {
  const supabase = getBrowserSupabaseClient();
  const current = await supabase.auth.getSession();
  const currentUser = current.data.session?.user as ({ id: string; is_anonymous?: boolean } | undefined);
  if (currentUser?.is_anonymous === true) return currentUser.id;

  const result = await supabase.auth.signInAnonymously();
  if (result.error || !result.data.user || result.data.user.is_anonymous !== true) {
    throw new Error("Unable to start the customer Session identity.");
  }
  return result.data.user.id;
}
