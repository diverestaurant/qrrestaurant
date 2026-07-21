import type { CustomerMenuItemView } from "@/contracts/view-models";

export type CustomerCartLine = {
  key: string;
  item: CustomerMenuItemView;
  quantity: number;
  variantId?: string;
  modifierOptionIds: string[];
  unitPriceMinor: number;
  note?: string;
};

export type CustomerCart = Readonly<Record<string, CustomerCartLine>>;

function configuredPrice(item: CustomerMenuItemView, variantId: string | undefined, modifierOptionIds: string[]) {
  const variantDelta = item.variants.find((variant) => variant.id === variantId)?.priceDeltaMinor ?? 0;
  const options = item.modifierGroups.flatMap((group) => group.options);
  return item.priceMinor + variantDelta + modifierOptionIds.reduce((sum, optionId) => sum + (options.find((option) => option.id === optionId)?.priceDeltaMinor ?? 0), 0);
}

export function reconcileCustomerCart(cart: CustomerCart, menuItems: CustomerMenuItemView[]) {
  const currentItems = new Map(menuItems.map((item) => [item.id, item]));
  const next: Record<string, CustomerCartLine> = {};
  let removedCount = 0;
  let repricedCount = 0;

  for (const line of Object.values(cart)) {
    const item = currentItems.get(line.item.id);
    const validVariant = !line.variantId || item?.variants.some((variant) => variant.id === line.variantId);
    const validOptionIds = new Set(item?.modifierGroups.flatMap((group) => group.options.map((option) => option.id)) ?? []);
    const validModifiers = line.modifierOptionIds.every((optionId) => validOptionIds.has(optionId));
    if (!item || !item.available || !validVariant || !validModifiers) {
      removedCount += line.quantity;
      continue;
    }

    const unitPriceMinor = configuredPrice(item, line.variantId, line.modifierOptionIds);
    if (unitPriceMinor !== line.unitPriceMinor) repricedCount += line.quantity;
    next[line.key] = { ...line, item, unitPriceMinor };
  }

  return { cart: next, removedCount, repricedCount, changed: removedCount > 0 || repricedCount > 0 };
}
