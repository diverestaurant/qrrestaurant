import { describe, expect, it } from "vitest";
import { hasStaffPageAccess } from "@/modules/identity/application/staff-page-access";

const scope = {
  restaurantId: "00000000-0000-4000-8000-000000000001",
  branchId: "00000000-0000-4000-8000-000000000002",
};

describe("staff page access", () => {
  it("requires a permanent identity, an active scoped membership and every capability", () => {
    const memberships = [{ ...scope, roleId: "role-manager", status: "ACTIVE" }];
    const permissions = [
      { roleId: "role-manager", permissionKey: "menu.manage" },
      { roleId: "role-manager", permissionKey: "report.read" },
    ];

    expect(hasStaffPageAccess({ ...scope, isAnonymous: false, memberships, permissions, requiredCapabilities: ["menu.manage", "report.read"] })).toBe(true);
    expect(hasStaffPageAccess({ ...scope, isAnonymous: true, memberships, permissions, requiredCapabilities: ["menu.manage"] })).toBe(false);
    expect(hasStaffPageAccess({ ...scope, isAnonymous: false, memberships, permissions, requiredCapabilities: ["staff.manage"] })).toBe(false);
  });

  it("rejects suspended and cross-tenant memberships while allowing restaurant-wide scope", () => {
    const permissions = [{ roleId: "role-waiter", permissionKey: "order.serve" }];
    const requiredCapabilities = ["order.serve"] as const;

    expect(hasStaffPageAccess({ ...scope, isAnonymous: false, memberships: [{ ...scope, roleId: "role-waiter", status: "SUSPENDED" }], permissions, requiredCapabilities: [...requiredCapabilities] })).toBe(false);
    expect(hasStaffPageAccess({ ...scope, isAnonymous: false, memberships: [{ ...scope, branchId: "00000000-0000-4000-8000-000000000099", roleId: "role-waiter", status: "ACTIVE" }], permissions, requiredCapabilities: [...requiredCapabilities] })).toBe(false);
    expect(hasStaffPageAccess({ ...scope, isAnonymous: false, memberships: [{ ...scope, branchId: null, roleId: "role-waiter", status: "ACTIVE" }], permissions, requiredCapabilities: [...requiredCapabilities] })).toBe(true);
  });
});
