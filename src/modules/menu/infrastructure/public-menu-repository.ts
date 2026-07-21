import "server-only";

import { AppError } from "@/lib/errors";
import type { CustomerMenuModifierGroupView, CustomerMenuView } from "@/contracts/view-models";
import { isWithinOperatingWindow } from "@/modules/menu/domain/operating-window";
import { getServerSupabaseClient } from "@/server/supabase/server";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role";

type PublicMenuLookup = { restaurantSlug: string; branchSlug: string };

type RestaurantRow = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; default_currency: string };
type BranchRow = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; currency: string; timezone: string };
type CategoryRow = { id: string; name: string; sort_order: number };
type MenuItemRow = { id: string; category_id: string; name: string; description: string | null; base_price_minor: number | string; currency: string; available: boolean; image_path: string | null; image_alt: string | null; featured: boolean; spice_level: number; operating_rules: Record<string, unknown> | null };
type VariantRow = { id: string; menu_item_id: string; name: string; price_delta_minor: number | string };
type ModifierGroupRow = { id: string; name: string; required: boolean; min_selections: number; max_selections: number };
type ModifierOptionRow = { id: string; group_id: string; name: string; price_delta_minor: number | string };
type ItemModifierGroupRow = { menu_item_id: string; group_id: string; sort_order: number };

function safeMinor(value: number | string, label: string) {
  const minor = Number(value);
  if (!Number.isSafeInteger(minor)) throw new AppError("INTERNAL_ERROR", `The menu contains an invalid ${label}.`);
  return minor;
}

function normalizeSlug(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) throw new AppError("VALIDATION_ERROR", `${label} is invalid.`);
  return normalized;
}

export async function readPublicMenu(input: PublicMenuLookup): Promise<CustomerMenuView> {
  const restaurantSlug = normalizeSlug(input.restaurantSlug, "Restaurant");
  const branchSlug = normalizeSlug(input.branchSlug, "Branch");
  const supabase = await getServerSupabaseClient();

  const restaurantResult = await supabase.from("restaurants").select("id,name,slug,status,default_currency").eq("slug", restaurantSlug).eq("status", "ACTIVE").maybeSingle();
  if (restaurantResult.error) throw new AppError("INTERNAL_ERROR", "Unable to load the restaurant menu.", true);
  const restaurant = restaurantResult.data as RestaurantRow | null;
  if (!restaurant) throw new AppError("NOT_FOUND", "Restaurant not found.");

  const branchResult = await supabase.from("branches").select("id,name,slug,status,currency,timezone").eq("restaurant_id", restaurant.id).eq("slug", branchSlug).eq("status", "ACTIVE").maybeSingle();
  if (branchResult.error) throw new AppError("INTERNAL_ERROR", "Unable to load the branch menu.", true);
  const branch = branchResult.data as BranchRow | null;
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found.");

  const [categoriesResult, itemsResult, variantsResult, groupsResult, optionsResult, linksResult] = await Promise.all([
    supabase.from("menu_categories").select("id,name,sort_order").eq("branch_id", branch.id).eq("visible", true).order("sort_order", { ascending: true }),
    supabase.from("menu_items").select("id,category_id,name,description,base_price_minor,currency,available,image_path,image_alt,featured,spice_level,operating_rules").eq("branch_id", branch.id).eq("visible", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("menu_item_variants").select("id,menu_item_id,name,price_delta_minor").eq("branch_id", branch.id).eq("active", true).order("sort_order", { ascending: true }),
    supabase.from("modifier_groups").select("id,name,required,min_selections,max_selections").eq("branch_id", branch.id).eq("active", true).order("name", { ascending: true }),
    supabase.from("modifier_options").select("id,group_id,name,price_delta_minor").eq("branch_id", branch.id).eq("active", true).order("sort_order", { ascending: true }),
    supabase.from("menu_item_modifier_groups").select("menu_item_id,group_id,sort_order").eq("branch_id", branch.id).order("sort_order", { ascending: true }),
  ]);
  if (categoriesResult.error || itemsResult.error || variantsResult.error || groupsResult.error || optionsResult.error || linksResult.error) throw new AppError("INTERNAL_ERROR", "Unable to load the branch menu.", true);

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const menuRows = (itemsResult.data ?? []) as MenuItemRow[];
  const imagePaths = menuRows.map((item) => item.image_path).filter((path): path is string => Boolean(path));
  const imageUrls = new Map<string, string>();
  if (imagePaths.length > 0) {
    const signed = await getServiceRoleSupabaseClient().storage.from("menu-images").createSignedUrls(imagePaths, 60 * 60);
    if (signed.error) throw new AppError("INTERNAL_ERROR", "Unable to sign menu images.", true);
    for (const item of signed.data ?? []) if (item.path && item.signedUrl) imageUrls.set(item.path, item.signedUrl);
  }
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const variantsByItem = new Map<string, Array<{ id: string; name: string; priceDeltaMinor: number }>>();
  for (const variant of (variantsResult.data ?? []) as VariantRow[]) {
    const priceDeltaMinor = safeMinor(variant.price_delta_minor, "variant price");
    const current = variantsByItem.get(variant.menu_item_id) ?? [];
    current.push({ id: variant.id, name: variant.name, priceDeltaMinor });
    variantsByItem.set(variant.menu_item_id, current);
  }
  const groupsById = new Map<string, ModifierGroupRow>(((groupsResult.data ?? []) as ModifierGroupRow[]).map((group) => [group.id, group]));
  const optionsByGroup = new Map<string, Array<{ id: string; name: string; priceDeltaMinor: number }>>();
  for (const option of (optionsResult.data ?? []) as ModifierOptionRow[]) {
    const priceDeltaMinor = safeMinor(option.price_delta_minor, "modifier price");
    const current = optionsByGroup.get(option.group_id) ?? [];
    current.push({ id: option.id, name: option.name, priceDeltaMinor });
    optionsByGroup.set(option.group_id, current);
  }
  const groupsByItem = new Map<string, CustomerMenuModifierGroupView[]>();
  for (const link of (linksResult.data ?? []) as ItemModifierGroupRow[]) {
    const group = groupsById.get(link.group_id);
    if (!group) throw new AppError("INTERNAL_ERROR", "The menu contains an invalid modifier group link.");
    const current = groupsByItem.get(link.menu_item_id) ?? [];
    current.push({ id: group.id, name: group.name, required: group.required, minSelections: group.min_selections, maxSelections: group.max_selections, options: optionsByGroup.get(group.id) ?? [] });
    groupsByItem.set(link.menu_item_id, current);
  }
  const items = menuRows.map((item) => {
    const priceMinor = safeMinor(item.base_price_minor, "base price");
    if (priceMinor < 0 || item.currency !== branch.currency) throw new AppError("INTERNAL_ERROR", "The menu contains an invalid price configuration.");
    const withinOperatingWindow = isWithinOperatingWindow(item.operating_rules ?? {}, branch.timezone);
    const available = item.available && withinOperatingWindow;
    return { id: item.id, name: item.name, description: item.description ?? "", priceMinor, available, availabilityReason: available ? "AVAILABLE" as const : item.available ? "OUTSIDE_HOURS" as const : "SOLD_OUT" as const, category: categoryNames.get(item.category_id) ?? "Menu", imageUrl: item.image_path ? imageUrls.get(item.image_path) ?? null : null, imageAlt: item.image_alt ?? item.name, featured: item.featured, spiceLevel: item.spice_level, variants: variantsByItem.get(item.id) ?? [], modifierGroups: groupsByItem.get(item.id) ?? [] };
  });
  const now = new Date().toISOString();
  return { status: items.length > 0 ? "ready" : "empty", freshness: "fresh", restaurantId: restaurant.id, branchId: branch.id, restaurantName: restaurant.name, branchName: branch.name, currency: branch.currency || restaurant.default_currency, serverTime: now, lastSyncedAt: now, items };
}
