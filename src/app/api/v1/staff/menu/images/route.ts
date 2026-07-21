import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, correlationId, toErrorEnvelope } from "@/lib/errors";
import {
  MENU_IMAGE_MAX_DIMENSION,
  isScopedMenuImagePath,
  menuImageCleanupSchema,
  menuImageDimensions,
  menuImageExtension,
  menuImageIntentSchema,
  menuImageVerificationSchema,
  type MenuImageIntent,
} from "@/modules/admin/contracts/menu-image";
import { requireStaffCapabilities } from "@/server/staff-command-access";
import { getServerSupabaseClient } from "@/server/supabase/server";

const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function errorResponse(error: unknown, requestId: string) {
  const body = toErrorEnvelope(error instanceof z.ZodError
    ? new AppError("VALIDATION_ERROR", "Menu image fields are invalid.")
    : error, requestId);
  const status = body.error.code === "UNAUTHORIZED" ? 401
    : body.error.code === "FORBIDDEN" ? 403
      : body.error.code === "NOT_FOUND" ? 404
        : body.error.code === "VALIDATION_ERROR" ? 400
          : body.error.code === "STALE_STATE" || body.error.code === "CONFLICT" ? 409
            : 503;
  return NextResponse.json(body, { status, headers: responseHeaders });
}

async function authorizeImageCommand(command: Pick<MenuImageIntent, "restaurantId" | "branchId" | "menuItemId">) {
  const supabase = await getServerSupabaseClient();
  const userResult = await supabase.auth.getUser();
  if (userResult.error || !userResult.data.user) throw new AppError("UNAUTHORIZED", "Staff sign-in is required.");
  await requireStaffCapabilities({
    branchId: command.branchId,
    restaurantId: command.restaurantId,
    requiredCapabilities: ["menu.manage"],
    supabase,
    user: userResult.data.user,
  });
  const itemResult = await supabase.from("menu_items")
    .select("id,version")
    .eq("id", command.menuItemId)
    .eq("restaurant_id", command.restaurantId)
    .eq("branch_id", command.branchId)
    .maybeSingle();
  if (itemResult.error) throw new AppError("INTERNAL_ERROR", "Unable to verify the menu image scope.", true);
  if (!itemResult.data) throw new AppError("NOT_FOUND", "Menu item not found.");
  return { supabase, item: itemResult.data };
}

export async function POST(request: Request) {
  const requestId = correlationId();
  try {
    const command = menuImageIntentSchema.parse(await readJson(request));
    const { supabase, item } = await authorizeImageCommand(command);
    if (item.version !== command.expectedVersion) throw new AppError("STALE_STATE", "The menu item changed. Refresh before uploading an image.", true);

    const extension = menuImageExtension(command.contentType);
    const imagePath = `${command.restaurantId}/${command.branchId}/${command.menuItemId}/${randomUUID()}.${extension}`;
    const signed = await supabase.storage.from("menu-images").createSignedUploadUrl(imagePath, { upsert: false });
    if (signed.error || !signed.data) throw new AppError("INTERNAL_ERROR", "Unable to authorize the private image upload.", true);

    return NextResponse.json({
      ok: true,
      data: { uploadUrl: signed.data.signedUrl, imagePath, expiresInSeconds: 2 * 60 * 60 },
      meta: { correlationId: requestId },
    }, { status: 201, headers: responseHeaders });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = correlationId();
  try {
    const command = menuImageCleanupSchema.parse(await readJson(request));
    const { supabase } = await authorizeImageCommand(command);
    if (!isScopedMenuImagePath(command)) throw new AppError("VALIDATION_ERROR", "The image path is outside the menu item scope.");
    const removed = await supabase.storage.from("menu-images").remove([command.imagePath]);
    if (removed.error) throw new AppError("INTERNAL_ERROR", "Unable to remove the private menu image.", true);
    return NextResponse.json({ ok: true, data: { imagePath: command.imagePath }, meta: { correlationId: requestId } }, { headers: responseHeaders });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PUT(request: Request) {
  const requestId = correlationId();
  try {
    const command = menuImageVerificationSchema.parse(await readJson(request));
    const { supabase } = await authorizeImageCommand(command);
    if (!isScopedMenuImagePath(command)) throw new AppError("VALIDATION_ERROR", "The image path is outside the menu item scope.");
    const downloaded = await supabase.storage.from("menu-images").download(command.imagePath);
    if (downloaded.error || !downloaded.data) throw new AppError("VALIDATION_ERROR", "The uploaded image could not be verified.");
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const dimensions = menuImageDimensions(command.contentType, bytes);
    if (bytes.byteLength !== command.size || !dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > MENU_IMAGE_MAX_DIMENSION || dimensions.height > MENU_IMAGE_MAX_DIMENSION) {
      await supabase.storage.from("menu-images").remove([command.imagePath]);
      throw new AppError("VALIDATION_ERROR", "The upload is not a valid JPEG, PNG, or WebP image within 4096 × 4096 pixels.");
    }
    return NextResponse.json({ ok: true, data: { imagePath: command.imagePath, ...dimensions }, meta: { correlationId: requestId } }, { headers: responseHeaders });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
