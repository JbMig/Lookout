import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadReport, newShareToken } from "@/lib/reports";

/** Crée (ou renvoie) le lien de partage en lecture seule. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/share">) => {
  const user = await requireUser("analyst");
  const { id } = await ctx.params;
  const report = await loadReport(id, user);
  const token = report.share_token ?? newShareToken();
  if (!report.share_token) await repo().update("reports", report.id, { share_token: token });
  return { token };
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/reports/[id]/share">) => {
  const user = await requireUser("analyst");
  const { id } = await ctx.params;
  const report = await loadReport(id, user);
  await repo().update("reports", report.id, { share_token: null });
  return { ok: true };
});
