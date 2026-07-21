import { z } from "zod";

export const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MENU_IMAGE_MAX_DIMENSION = 4096;
export const menuImageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const menuImageIntentSchema = z.object({
  restaurantId: z.uuid(),
  branchId: z.uuid(),
  menuItemId: z.uuid(),
  expectedVersion: z.int().positive(),
  imageAlt: z.string().trim().min(1).max(180),
  contentType: z.enum(menuImageContentTypes),
  size: z.int().positive().max(MENU_IMAGE_MAX_BYTES),
});

export const menuImageCleanupSchema = z.object({
  restaurantId: z.uuid(),
  branchId: z.uuid(),
  menuItemId: z.uuid(),
  imagePath: z.string().min(10).max(500),
});

export const menuImageVerificationSchema = menuImageCleanupSchema.extend({
  contentType: z.enum(menuImageContentTypes),
  size: z.int().positive().max(MENU_IMAGE_MAX_BYTES),
});

export type MenuImageIntent = z.infer<typeof menuImageIntentSchema>;
export type MenuImageUploadIntent = {
  uploadUrl: string;
  imagePath: string;
  expiresInSeconds: number;
};

export function menuImageExtension(contentType: (typeof menuImageContentTypes)[number]) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += segmentLength + 2;
  }
  return null;
}

export function menuImageDimensions(contentType: (typeof menuImageContentTypes)[number], bytes: Uint8Array) {
  if (contentType === "image/png") {
    if (bytes.length < 24 || ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (contentType === "image/jpeg") {
    if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
    return jpegDimensions(bytes);
  }
  if (bytes.length < 30 || new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF" || new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP") return null;
  const format = new TextDecoder().decode(bytes.slice(12, 16));
  if (format === "VP8X") return {
    width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
    height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
  };
  if (format === "VP8L" && bytes[20] === 0x2f) return {
    width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
    height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
  };
  if (format === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return {
    width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
    height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
  };
  return null;
}

export function isScopedMenuImagePath(input: {
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  imagePath: string;
}) {
  const prefix = `${input.restaurantId}/${input.branchId}/${input.menuItemId}/`;
  return input.imagePath.startsWith(prefix)
    && !input.imagePath.includes("..")
    && /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(input.imagePath.slice(prefix.length));
}
