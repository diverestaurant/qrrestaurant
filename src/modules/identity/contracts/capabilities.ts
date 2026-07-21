export const capabilityKeys = [
  "session.open", "session.close", "session.rotate_join_code", "order.submit", "order.accept", "order.prepare", "order.serve", "payment.begin", "payment.confirm", "discount.apply", "receipt.issue", "menu.manage", "table.manage", "staff.manage", "report.read", "audit.read",
] as const;

export type CapabilityKey = (typeof capabilityKeys)[number];
export type RoleKey = "PLATFORM" | "OWNER" | "MANAGER" | "KITCHEN" | "WAITER" | "CASHIER";

export function can(role: RoleKey, capability: CapabilityKey) {
  if (role === "PLATFORM" || role === "OWNER") return true;
  const map: Record<Exclude<RoleKey, "PLATFORM" | "OWNER">, CapabilityKey[]> = { MANAGER: ["session.open", "session.close", "session.rotate_join_code", "order.accept", "order.prepare", "order.serve", "payment.begin", "payment.confirm", "discount.apply", "receipt.issue", "menu.manage", "table.manage", "staff.manage", "report.read", "audit.read"], KITCHEN: ["order.accept", "order.prepare"], WAITER: ["session.open", "session.rotate_join_code", "order.submit", "order.serve"], CASHIER: ["session.close", "payment.begin", "payment.confirm", "receipt.issue"] };
  return map[role].includes(capability);
}
