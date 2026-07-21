import type { CapabilityKey } from "@/modules/identity/contracts/capabilities";

export type StaffMembershipScope = {
  branchId: string | null;
  restaurantId: string;
  roleId: string;
  status: string;
};

export type StaffRolePermission = {
  permissionKey: string;
  roleId: string;
};

type StaffPageAccessInput = {
  branchId: string;
  isAnonymous: boolean;
  memberships: StaffMembershipScope[];
  permissions: StaffRolePermission[];
  requiredCapabilities: CapabilityKey[];
  restaurantId: string;
};

export function hasStaffPageAccess(input: StaffPageAccessInput) {
  if (input.isAnonymous) return false;

  const scopedRoleIds = new Set(
    input.memberships
      .filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          membership.restaurantId === input.restaurantId &&
          (membership.branchId === null || membership.branchId === input.branchId),
      )
      .map((membership) => membership.roleId),
  );
  if (scopedRoleIds.size === 0) return false;

  const granted = new Set(
    input.permissions
      .filter((permission) => scopedRoleIds.has(permission.roleId))
      .map((permission) => permission.permissionKey),
  );
  return input.requiredCapabilities.every((capability) => granted.has(capability));
}
