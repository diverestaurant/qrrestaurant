import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const stagingUrl = "https://ztmftdjmtpwymfatmhjp.supabase.co";
const restaurantId = "00000000-0000-4000-8000-000000000001";
const branchId = "00000000-0000-4000-8000-000000000002";
const managerRoleId = "00000000-0000-4000-8000-000000000103";

if (process.env.NEXT_PUBLIC_SUPABASE_URL !== stagingUrl) {
  throw new Error("Refusing to manage synthetic staff outside the named Staging Supabase project.");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

const admin = createClient(stagingUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const action = process.argv[2];

if (action === "create") {
  const nonce = randomUUID();
  const email = `synthetic-manager-${nonce}@example.test`;
  const password = `Staging-only-${randomUUID()}!`;
  const membershipId = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Synthetic staff user was not created.");
  const userId = created.data.user.id;
  const membership = await admin.from("staff_memberships").insert({ id: membershipId, user_id: userId, restaurant_id: restaurantId, branch_id: branchId, role_id: managerRoleId, status: "ACTIVE" });
  if (membership.error) {
    await admin.auth.admin.deleteUser(userId);
    throw membership.error;
  }
  console.log(JSON.stringify({ email, membershipId, password, userId }));
} else if (action === "cleanup") {
  const userId = process.argv[3];
  const membershipId = process.argv[4];
  if (!userId || !membershipId) throw new Error("cleanup requires userId and membershipId.");
  const membership = await admin.from("staff_memberships").delete().eq("id", membershipId).eq("user_id", userId);
  if (membership.error) throw membership.error;
  const user = await admin.auth.admin.deleteUser(userId);
  if (user.error) throw user.error;
  console.log(JSON.stringify({ cleaned: true, membershipId, userId }));
} else {
  throw new Error("Use create or cleanup.");
}
