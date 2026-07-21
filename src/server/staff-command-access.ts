import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { hasStaffPageAccess, type StaffMembershipScope, type StaffRolePermission } from "@/modules/identity/application/staff-page-access";
import type { CapabilityKey } from "@/modules/identity/contracts/capabilities";

type MembershipRow = { branch_id: string | null; restaurant_id: string; role_id: string; status: string };
type RolePermissionRow = { permission_id: string; role_id: string };
type PermissionRow = { id: string; permission_key: string };

export async function requireStaffCapabilities(input: {
  branchId: string;
  requiredCapabilities: CapabilityKey[];
  restaurantId: string;
  supabase: SupabaseClient;
  user: User;
}) {
  const user = input.user as User & { is_anonymous?: boolean };
  if (user.is_anonymous === true) throw new AppError("FORBIDDEN", "A permanent staff identity is required.");

  const membershipResult = await input.supabase
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
  const scopedRoleIds = [...new Set(memberships
    .filter((membership) => membership.restaurantId === input.restaurantId && (membership.branchId === null || membership.branchId === input.branchId))
    .map((membership) => membership.roleId))];
  if (scopedRoleIds.length === 0) throw new AppError("FORBIDDEN", "This staff account cannot operate this branch.");

  const rolePermissionResult = await input.supabase.from("role_permissions").select("role_id,permission_id").in("role_id", scopedRoleIds);
  if (rolePermissionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff permissions.", true);
  const rolePermissions = (rolePermissionResult.data ?? []) as RolePermissionRow[];
  const permissionIds = [...new Set(rolePermissions.map((permission) => permission.permission_id))];
  const permissionResult = permissionIds.length > 0
    ? await input.supabase.from("permissions").select("id,permission_key").in("id", permissionIds)
    : { data: [], error: null };
  if (permissionResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify staff permissions.", true);
  const permissionById = new Map(((permissionResult.data ?? []) as PermissionRow[]).map((permission) => [permission.id, permission.permission_key]));
  const permissions = rolePermissions.flatMap<StaffRolePermission>((permission) => {
    const permissionKey = permissionById.get(permission.permission_id);
    return permissionKey ? [{ roleId: permission.role_id, permissionKey }] : [];
  });

  if (!hasStaffPageAccess({
    branchId: input.branchId,
    isAnonymous: false,
    memberships,
    permissions,
    requiredCapabilities: input.requiredCapabilities,
    restaurantId: input.restaurantId,
  })) throw new AppError("FORBIDDEN", "This staff account lacks the required permission.");
}
