import { accountForUser, requireUserId, routeError } from "@/lib/auth";
import { jobForAccount } from "@/lib/jobs/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await accountForUser(await requireUserId());
    const job = await jobForAccount(id, account.id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    return Response.json({ job });
  } catch (error) {
    return routeError(error);
  }
}
