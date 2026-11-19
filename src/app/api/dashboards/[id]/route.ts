import { handle } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { dashboardMeta } from "@/lib/dashboards";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/dashboards/[id]">) => {
  await requireUser();
  const { id } = await ctx.params;
  const report = await repo().get<Record<string, unknown>>("reports", id);
  if (!report) throw new HttpError(404, "Ce dashboard n'existe pas");
  return dashboardMeta(report);
});
