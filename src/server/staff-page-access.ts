import "server-only";

import { AppError } from "@/lib/errors";
import { hasStaffPageAccess, type StaffMembershipScope, type StaffRolePermission } from "@/modules/identity/application/staff-page-access";
import type { CapabilityKey } from "@/modules/identity/contracts/capabilities";
import { getServerSupabaseClient } from "@/server/supabase/server";

type MembershipRow = { branch_id: string | null; restaurant_id: string; role_id: string; status: string };
type RolePermissionRow = { permission_id: string; role_id: string };
type PermissionRow = { id: string; permission_key: string };
type RoleRow = { id: string; role_key: string };

export type StaffPageAccess =
  | { status: "signed_out" }
  | { email: string; status: "forbidden" }
  | { email: string; roleKeys: string[]; status: "authorized" };

export async function authorizeStaffPage(input: {
  branchId: string;
  requiredCapabilities: CapabilityKey[];
  restaurantId: string;
}): Promise<StaffPageAccess> {
  const supabase = await getServerSupabaseClient();
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) return { status: "signed_out" };

  const user = userResult.data.user as typeof userResult.data.user & { is_anonymous?: boolean };
  const email = user.email ?? "staff";
  if (user.is_anonymous === true) return { status: "forbidden", email };

  const membershipResult = await supabase
    .from("staff_memberships")
    .select("restaurant_id,branch_id,role_id,status")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");
  if (membershipResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff membership.", true);

  const memberships = ((membershipResult.data ?? []) as MembershipRow[]).map<StaffMembershipScope>((membership) => ({
    branchId: membership.branch_id,
    restaurantId: membership.restaurant_id,
    roleId: membership.role_id,
    status: membership.status,
  }));
  const scopedRoleIds = [...new Set(memberships.filter((membership) => membership.restaurantId === input.restaurantId && (membership.branchId === null || membership.branchId === input.branchId)).map((membership) => membership.roleId))];
  if (scopedRoleIds.length === 0) return { status: "forbidden", email };

  const rolePermissionResult = await supabase.from("role_permissions").select("role_id,permission_id").in("role_id", scopedRoleIds);
  if (rolePermissionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff permissions.", true);
  const rolePermissions = (rolePermissionResult.data ?? []) as RolePermissionRow[];
  const permissionIds = [...new Set(rolePermissions.map((permission) => permission.permission_id))];
  const permissionResult = permissionIds.length > 0
    ? await supabase.from("permissions").select("id,permission_key").in("id", permissionIds)
    : { data: [], error: null };
  if (permissionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff permissions.", true);
  const permissionById = new Map(((permissionResult.data ?? []) as PermissionRow[]).map((permission) => [permission.id, permission.permission_key]));
  const permissions = rolePermissions.flatMap<StaffRolePermission>((permission) => {
    const permissionKey = permissionById.get(permission.permission_id);
    return permissionKey ? [{ roleId: permission.role_id, permissionKey }] : [];
  });
  const rolesResult = await supabase.from("roles").select("id,role_key").in("id", scopedRoleIds);
  if (rolesResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff roles.", true);
  const roleKeys = ((rolesResult.data ?? []) as RoleRow[]).map((role) => role.role_key);

  return hasStaffPageAccess({
    branchId: input.branchId,
    isAnonymous: false,
    memberships,
    permissions,
    requiredCapabilities: input.requiredCapabilities,
    restaurantId: input.restaurantId,
  })
    ? { status: "authorized", email, roleKeys }
    : { status: "forbidden", email };
}
