import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadedObjects } from "@/lib/db/schema";
import { verifyUpload } from "@/lib/storage/r2";

const requestSchema = z.object({ objectKey: z.string().min(10).max(500) });

export async function POST(request: Request) {
  try {
    const { objectKey } = requestSchema.parse(await request.json());
    const account = await accountForUser(await requireUserId());
    const [upload] = await db()
      .select()
      .from(uploadedObjects)
      .where(
        and(eq(uploadedObjects.objectKey, objectKey), eq(uploadedObjects.accountId, account.id)),
      )
      .limit(1);
    if (!upload) return Response.json({ error: "Upload not found" }, { status: 404 });
    await verifyUpload(upload.objectKey, upload.bytes);
    await db()
      .update(uploadedObjects)
      .set({ verifiedAt: new Date() })
      .where(eq(uploadedObjects.objectKey, objectKey));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid completion request" }, { status: 400 });
    }
    return routeError(error);
  }
}
