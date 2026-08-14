import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { jobForAccount } from "@/lib/jobs/service";
import { presignDownload } from "@/lib/storage/r2";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await accountForUser(await requireUserId());
    const job = await jobForAccount(id, account.id);
    if (!job?.outputKey) return Response.json({ error: "Result not found" }, { status: 404 });
    if (!job.purgeAfter || job.purgeAfter <= new Date()) {
      return Response.json({ error: "This private download has expired" }, { status: 410 });
    }
    const outputName = job.fileName.replace(/(\.[^.]+)?$/, ".clean$1");
    return Response.redirect(await presignDownload(job.outputKey, outputName), 303);
  } catch (error) {
    return routeError(error);
  }
}
