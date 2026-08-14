import { z } from "zod";

import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadedObjects } from "@/lib/db/schema";
import { featureFlags } from "@/lib/env";
import { presignUpload, uploadObjectKey, validateUpload } from "@/lib/storage/r2";

const requestSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  bytes: z.number().int().positive().max(100 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    if (!featureFlags.r2) throw new Error("R2 upload storage is not configured");
    const input = requestSchema.parse(await request.json());
    validateUpload(input.contentType, input.bytes);
    const account = await accountForUser(await requireUserId());
    const objectKey = uploadObjectKey(account.id, input.fileName);
    const purgeAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [uploadUrl] = await Promise.all([
      presignUpload(objectKey, input.contentType, input.bytes),
      db().insert(uploadedObjects).values({
        objectKey,
        accountId: account.id,
        contentType: input.contentType,
        bytes: input.bytes,
        purgeAfter,
      }),
    ]);
    return Response.json({ uploadUrl, objectKey, expiresInSeconds: 600 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid upload request" }, { status: 400 });
    }
    return routeError(error);
  }
}
