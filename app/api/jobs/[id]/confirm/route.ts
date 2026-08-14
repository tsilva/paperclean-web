import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { featureFlags } from "@/lib/env";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { confirmJob } from "@/lib/jobs/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!featureFlags.conversion) {
    return Response.json(
      { error: "Document conversion is temporarily unavailable" },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const account = await accountForUser(await requireUserId());
    const job = await confirmJob(id, account.id);
    await dispatchJob(job.id, "process");
    return Response.json({ job });
  } catch (error) {
    return routeError(error);
  }
}
