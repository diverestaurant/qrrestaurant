import { describe, expect, it } from "vitest";
import {
  MENU_IMAGE_MAX_BYTES,
  isScopedMenuImagePath,
  menuImageDimensions,
  menuImageExtension,
  menuImageIntentSchema,
} from "@/modules/admin/contracts/menu-image";

const scope = {
  restaurantId: "00000000-0000-4000-8000-000000000001",
  branchId: "00000000-0000-4000-8000-000000000002",
  menuItemId: "00000000-0000-4000-8000-000000000403",
};

describe("menu image contract", () => {
  it("maps only approved image MIME types to normalized extensions", () => {
    expect(menuImageExtension("image/jpeg")).toBe("jpg");
    expect(menuImageExtension("image/png")).toBe("png");
    expect(menuImageExtension("image/webp")).toBe("webp");
  });

  it("accepts the exact restaurant, branch and menu-item path shape", () => {
    expect(isScopedMenuImagePath({
      ...scope,
      imagePath: `${scope.restaurantId}/${scope.branchId}/${scope.menuItemId}/00000000-0000-4000-8000-000000000999.webp`,
    })).toBe(true);
    expect(isScopedMenuImagePath({
      ...scope,
      imagePath: `${scope.restaurantId}/${scope.branchId}/../00000000-0000-4000-8000-000000000999.webp`,
    })).toBe(false);
    expect(isScopedMenuImagePath({
      ...scope,
      imagePath: `${scope.restaurantId}/00000000-0000-4000-8000-000000000999/${scope.menuItemId}/00000000-0000-4000-8000-000000000999.webp`,
    })).toBe(false);
  });

  it("rejects unsupported and oversized upload intents", () => {
    const base = { ...scope, expectedVersion: 1, imageAlt: "Synthetic plate", size: 128 };
    expect(menuImageIntentSchema.safeParse({ ...base, contentType: "image/png" }).success).toBe(true);
    expect(menuImageIntentSchema.safeParse({ ...base, contentType: "image/svg+xml" }).success).toBe(false);
    expect(menuImageIntentSchema.safeParse({ ...base, contentType: "image/png", size: MENU_IMAGE_MAX_BYTES + 1 }).success).toBe(false);
  });

  it("reads approved image signatures and rejects MIME disguises", () => {
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    expect(menuImageDimensions("image/png", png)).toEqual({ width: 1, height: 1 });
    expect(menuImageDimensions("image/png", new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(menuImageDimensions("image/jpeg", png)).toBeNull();
  });
});
